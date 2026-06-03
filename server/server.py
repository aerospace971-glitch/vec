from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import tempfile
import json
import os
import sqlite3
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

app = Flask(__name__)

# ── Fix 4: CORS restricted to allowed origins only ─────────────────
_raw_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(',') if o.strip()]
CORS(app, origins=ALLOWED_ORIGINS)

# Path to your compiled vec.exe
COMPILER_PATH = os.path.join(
    os.path.dirname(__file__),
    '..', 'backend', 'src', 'vec'
)
if os.name == "nt":
    COMPILER_PATH +=".exe"
DB_PATH = os.path.join(os.path.dirname(__file__), 'users.db')

SQL_CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    token TEXT UNIQUE,
    token_expires_at TEXT,
    created_at TEXT NOT NULL
);
"""

SQL_CREATE_CODES = """
CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    title TEXT,
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""

SQL_CREATE_OTPS = """
CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target TEXT NOT NULL,
    kind TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
);
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(SQL_CREATE_USERS)
        conn.execute(SQL_CREATE_CODES)
        conn.execute(SQL_CREATE_OTPS)
        # Migrations: add any missing columns (safe to run multiple times)
        migrations = [
            'ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ""',
            'ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ""',
            'ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ""',
            'ALTER TABLE users ADD COLUMN token_expires_at TEXT',
        ]
        for sql in migrations:
            try:
                conn.execute(sql)
            except Exception:
                pass  # Column already exists — safe to ignore


# ── Fix 1: bcrypt password hashing (replaces plain SHA256) ─────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def check_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    # Bcrypt hashes start with $2b$ — use bcrypt
    if stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            return False
    # Legacy SHA256 hash (64 hex chars) — verify and signal for migration
    import hashlib
    return hashlib.sha256(password.encode('utf-8')).hexdigest() == stored_hash


# ── Fix 2: Token with 7-day expiry ─────────────────────────────────
def generate_token() -> tuple:
    token = secrets.token_urlsafe(32)
    expires_at = (utcnow() + timedelta(days=7)).isoformat()
    return token, expires_at


def get_user_by_token(token: str):
    if not token:
        return None
    now = utcnow().isoformat()
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM users WHERE token = ? AND token_expires_at >= ?',
            (token, now)
        ).fetchone()
        return dict(row) if row else None


def _send_email_smtp(to_email: str, subject: str, body: str) -> bool:
    import smtplib
    from email.message import EmailMessage

    host = os.environ.get('SMTP_HOST')
    port = int(os.environ.get('SMTP_PORT', '0') or 0)
    user = os.environ.get('SMTP_USER')
    password = os.environ.get('SMTP_PASS')

    if not host or not port or not user or not password:
        return False

    try:
        msg = EmailMessage()
        msg['From'] = user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.set_content(body)

        with smtplib.SMTP(host, port, timeout=10) as s:
            s.starttls()
            s.login(user, password)
            s.send_message(msg)
        print(f"[OTP] Email sent to {to_email} via SMTP host={host} user={user}")
        return True
    except Exception as exc:
        print(f"[OTP] Email send failed for {to_email}: {exc}")
        return False


def create_otp(target: str, kind: str = 'email', code: str = None, ttl_seconds: int = 300):
    if code is None:
        code = str(secrets.randbelow(90000) + 10000)
    now = utcnow()
    expires = now + timedelta(seconds=ttl_seconds)
    with get_db() as conn:
        conn.execute(
            'INSERT INTO otps (target, kind, code, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)',
            (target, kind, code, now.isoformat(), expires.isoformat())
        )
    return code


def verify_otp(target: str, code: str, kind: str = 'email') -> bool:
    now = utcnow().isoformat()
    with get_db() as conn:
        row = conn.execute(
            'SELECT id FROM otps WHERE target = ? AND kind = ? AND code = ? AND used = 0 AND expires_at >= ? ORDER BY created_at DESC LIMIT 1',
            (target, kind, code, now)
        ).fetchone()
        if not row:
            return False
        conn.execute('UPDATE otps SET used = 1 WHERE id = ?', (row['id'],))
        return True


def authenticate_request():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
        return get_user_by_token(token)
    return None


def run_compiler(source: str, phase: str = 'all') -> dict:
    with tempfile.NamedTemporaryFile(
        suffix='.cpp', mode='w', delete=False, encoding='utf-8'
    ) as f:
        f.write(source)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [COMPILER_PATH, tmp_path, f'--phase={phase}'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if not result.stdout.strip():
            return {
                'error': result.stderr or 'Compiler produced no output',
                'tokens': [],
                'lexer_errors': []
            }

        return json.loads(result.stdout)

    except subprocess.TimeoutExpired:
        return {'error': 'Compilation timed out (10s limit)'}

    except json.JSONDecodeError as e:
        return {
            'error': f'Invalid JSON from compiler: {str(e)}',
            'raw':   result.stdout[:500]
        }

    except FileNotFoundError:
        return {
            'error': f'Compiler not found at: {COMPILER_PATH} '
                      '— run: g++ -std=c++17 main.cpp lexer.cpp -o vec',
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.route('/health', methods=['GET'])
def health():
    compiler_exists = os.path.exists(COMPILER_PATH)
    return jsonify({
        'status': 'ok',
        'compiler_found': compiler_exists,
        'compiler_path': COMPILER_PATH
    })


@app.route('/compile', methods=['POST'])
def compile_source():
    data = request.get_json()

    if not data or 'source' not in data:
        return jsonify({'error': 'Missing "source" field'}), 400

    if len(data['source']) > 100_000:
        return jsonify({'error': 'Source too large (max 100KB)'}), 400

    result = run_compiler(
        source=data['source'],
        phase=data.get('phase', 'all')
    )
    return jsonify(result)


@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    required = ['firstName', 'lastName', 'email', 'username', 'password']
    if any(not data.get(field) for field in required):
        return jsonify({'error': 'Missing required fields.'}), 400

    password = data['password']
    username = data['username'].strip().lower()
    email = data['email'].strip().lower()
    phone = (data.get('phone') or '').strip()
    first_name = data['firstName'].strip()
    last_name = data['lastName'].strip()

    with get_db() as conn:
        if conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone():
            return jsonify({'error': 'Username already taken.'}), 400
        if conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
            return jsonify({'error': 'Email already registered.'}), 400

        token, expires_at = generate_token()
        password_hash = hash_password(password)
        now = utcnow().isoformat()
        conn.execute(
            'INSERT INTO users (username, email, phone, first_name, last_name, password_hash, token, token_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (username, email, phone, first_name, last_name, password_hash, token, expires_at, now)
        )
        user_row = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

    user = dict(user_row)
    user.pop('password_hash', None)
    return jsonify({'user': user, 'token': token})


@app.route('/auth/signin', methods=['POST'])
def signin():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    with get_db() as conn:
        row = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if not row:
            return jsonify({'error': 'Invalid username or password.'}), 401
        row = dict(row)

        if not check_password(password, row['password_hash']):
            return jsonify({'error': 'Invalid username or password.'}), 401

        # Refresh token on every login with new 7-day expiry
        token, expires_at = generate_token()
        conn.execute(
            'UPDATE users SET token = ?, token_expires_at = ? WHERE id = ?',
            (token, expires_at, row['id'])
        )

    row.pop('password_hash', None)
    row['token'] = token
    row['token_expires_at'] = expires_at
    return jsonify({'user': row, 'token': token})


@app.route('/auth/me', methods=['GET'])
def auth_me():
    user = authenticate_request()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    user.pop('password_hash', None)
    return jsonify({'user': user})


# ── Fix 3: Server-side logout — invalidates token in DB ────────────
@app.route('/auth/signout', methods=['POST'])
def signout():
    user = authenticate_request()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    with get_db() as conn:
        conn.execute(
            'UPDATE users SET token = NULL, token_expires_at = NULL WHERE id = ?',
            (user['id'],)
        )
    return jsonify({'ok': True})


@app.route('/user/dashboard', methods=['GET'])
def user_dashboard():
    user = authenticate_request()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    with get_db() as conn:
        rows = conn.execute(
            'SELECT id, kind, title, code, created_at FROM codes WHERE user_id = ? ORDER BY created_at DESC',
            (user['id'],)
        ).fetchall()
    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'phone': user['phone'],
            'first_name': user['first_name'],
            'last_name': user['last_name'],
        },
        'codes': [dict(row) for row in rows]
    })


@app.route('/user/save', methods=['POST'])
def save_user_code():
    user = authenticate_request()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    kind = data.get('kind') or 'compiler'
    title = data.get('title') or ''
    code = data.get('code') or ''

    if not code.strip():
        return jsonify({'error': 'Code cannot be empty.'}), 400

    with get_db() as conn:
        created_at = utcnow().isoformat()
        conn.execute(
            'INSERT INTO codes (user_id, kind, title, code, created_at) VALUES (?, ?, ?, ?, ?)',
            (user['id'], kind, title, code, created_at)
        )

    return jsonify({'status': 'saved'})


@app.route('/phases', methods=['GET'])
def list_phases():
    return jsonify({
        'phases': ['lex', 'parse', 'semantic', 'ir', 'opt', 'codegen', 'all']
    })


@app.route('/auth/send-otp', methods=['POST'])
def auth_send_otp():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    kind = (data.get('kind') or 'email').strip()
    if not email:
        return jsonify({'error': 'Missing email.'}), 400

    code = create_otp(email, kind=kind)
    subject = 'Your VEC verification code'
    body = f'Your verification code is: {code}\nIt expires in 5 minutes.'
    sent = _send_email_smtp(email, subject, body)
    smtp_enabled = all([
        os.environ.get('SMTP_HOST'),
        os.environ.get('SMTP_PORT'),
        os.environ.get('SMTP_USER'),
        os.environ.get('SMTP_PASS'),
    ])
    if not sent:
        if smtp_enabled:
            return jsonify({'error': 'Failed to send OTP email. Check SMTP configuration.'}), 500
        return jsonify({'sent': False, 'dev_otp': code})
    return jsonify({'sent': True})


@app.route('/auth/verify-otp', methods=['POST'])
def auth_verify_otp():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('otp') or '').strip()
    kind = (data.get('kind') or 'email').strip()
    if not email or not code:
        return jsonify({'error': 'Missing email or otp.'}), 400
    ok = verify_otp(email, code, kind=kind)
    if not ok:
        return jsonify({'error': 'Invalid or expired OTP.'}), 400
    return jsonify({'ok': True})


@app.route('/execute', methods=['POST'])
def execute_vrm():
    data = request.get_json() or {}
    instructions_raw = data.get('instructions', [])
    inputs = list(data.get('inputs', []))
    max_steps = min(int(data.get('maxSteps', 10000)), 50000)

    def _parse_instr(instr):
        if isinstance(instr, str):
            instr = {'code': instr}
        line = (instr.get('code') or '').strip()
        op = (instr.get('op', '') or '').strip().upper()
        if op == 'PRINT' or line.upper().startswith('PRINT '):
            val = line[6:].strip() if len(line) > 6 else (instr.get('dst') or instr.get('arg1') or '')
            return {**instr, 'op': 'PRINT', 'dst': val, 'src1': val, '_printVal': val, 'src2': ''}
        if line.endswith(':') or op in ('LABEL', 'FUNC_BEGIN', 'FUNC_END'):
            name = (instr.get('dst') or instr.get('result') or line.rstrip(':').strip() or '')
            if op == 'FUNC_BEGIN':
                display = f'FUNC_BEGIN {name}'
            elif op == 'FUNC_END':
                display = f'FUNC_END {name}'
            else:
                display = f'{name}:'
            return {**instr, 'op': op or 'LABEL', 'dst': name, 'src1': '', 'src2': '', 'code': display}
        if op:
            return dict({**instr, 'op': op})
        if line:
            const_parts = line.replace(',', '').split()
            parts = [p.upper() if i == 0 else p for i, p in enumerate(const_parts)]
            if parts and parts[0] == 'CMP':
                return {**instr,
                        'op': 'CMP',
                        'dst': '',
                        'src1': parts[1] if len(parts) > 1 else '',
                        'src2': parts[2] if len(parts) > 2 else ''}
            return {**instr,
                    'op': parts[0] if parts else 'NOP',
                    'dst': parts[1] if len(parts) > 1 else '',
                    'src1': parts[2] if len(parts) > 2 else '',
                    'src2': parts[3] if len(parts) > 3 else ''}
        parts = (instr.get('code') or '').replace(',', '').split()
        return {**instr,
                'dst': instr.get('dst') or (parts[1] if len(parts) > 1 else ''),
                'src1': instr.get('src1') or (parts[2] if len(parts) > 2 else ''),
                'src2': instr.get('src2') or (parts[3] if len(parts) > 3 else '')}

    VRM_OPS = {
        'MOV','LOAD','STORE','PUSH','POP',
        'ADD','SUB','MUL','DIV','MOD','NEG',
        'AND','OR','NOT','XOR','SHL','SHR','THROW',
        'ALLOC','FREE',
        'CMP','SETE','SETNE','SETL','SETG','SETLE','SETGE',
        'JMP','JZ','JNZ','CALL','RET',
        'LABEL','FUNC_BEGIN','FUNC_END',
        'PRINT','READ','NOP',
    }

    def _should_include(i):
        op = (i.get('op', '') if isinstance(i, dict) else '').upper()
        if isinstance(i, dict) and op in VRM_OPS:
            return True
        c = i.strip() if isinstance(i, str) else (i.get('code') or '').strip()
        return bool(c) and not c.startswith(';') and not c.startswith('//') \
            and not c.startswith('section') \
            and not c.lower().startswith('target:') \
            and not c.lower().startswith('registers:')

    instrs = [_parse_instr(i) for i in instructions_raw if _should_include(i)]

    label_map = {}
    for idx, instr in enumerate(instrs):
        op = (instr.get('op') or '').upper()
        if op in ('LABEL', 'FUNC_BEGIN'):
            name = (instr.get('dst') or instr.get('result') or '').rstrip(':').strip()
            if name:
                label_map[name] = idx

    regs = {'R0': 0, 'R1': 0, 'R2': 0, 'R3': 0, 'R4': 0, 'R5': 0, 'R6': 0, 'R7': 0}
    mem = {}
    heap = {}
    stack = []
    call_stack = []
    output = []
    pc = label_map.get('main', 0)
    halted = False
    cmp_result = 0
    input_idx = 0

    def _resolve(val):
        if not val or val == '—':
            return 0
        val = str(val).strip()
        if val.startswith('#'):
            try:
                return float(val[1:]) if '.' in val[1:] else int(val[1:])
            except Exception:
                return 0
        if val.startswith('"') and val.endswith('"'):
            return val[1:-1]
        if val in ('\\n', '\n'):
            return '\n'
        if val in regs:
            return regs[val]
        if val.startswith('MEM['):
            try:
                return mem.get(int(val[4:-1]), 0)
            except Exception:
                return 0
        try:
            return float(val) if '.' in val else int(val)
        except Exception:
            return val

    def _memory_index(addr):
        raw = str(addr or '').strip()
        if raw.startswith('[') and raw.endswith(']'):
            raw = raw[1:-1].strip()
        if raw.startswith('MEM[') and raw.endswith(']'):
            try:
                return int(raw[4:-1])
            except Exception:
                return None
        return None

    def _resolve_jump(jump):
        if jump is None:
            return None
        if isinstance(jump, int):
            return jump
        clean = str(jump).rstrip(':').strip()
        if clean in label_map:
            return label_map[clean]
        try:
            return int(clean)
        except Exception:
            return None

    def _snap(changed_r=None):
        return {
            'registers': dict(regs),
            'memory': {str(k): v for k, v in mem.items()},
            'stack': list(stack),
            'call_stack': list(call_stack),
            'sp': len(stack),
            'output': list(output),
            'pc': pc,
            'halted': halted,
            'cmp_result': cmp_result,
            'changed_regs': list(changed_r) if changed_r else [],
        }

    trace = [_snap()]
    steps = 0

    while not halted and pc < len(instrs) and steps < max_steps:
        instr = instrs[pc]
        op   = instr.get('op', '')
        dst  = instr.get('dst', '') or ''
        src1 = instr.get('src1', '') or instr.get('arg1', '') or ''
        src2 = instr.get('src2', '') or instr.get('arg2', '') or ''
        prev_regs = dict(regs)
        jump = None

        if op in ('MOV', 'LOAD'):
            if dst in regs:
                regs[dst] = _resolve(src1)
        elif op == 'STORE':
            idx = _memory_index(dst)
            if idx is not None:
                mem[idx] = _resolve(src1)
        elif op == 'ADD':
            if dst in regs:
                regs[dst] = _resolve(src1) + _resolve(src2)
        elif op == 'SUB':
            if dst in regs:
                regs[dst] = _resolve(src1) - _resolve(src2)
        elif op == 'MUL':
            if dst in regs:
                regs[dst] = _resolve(src1) * _resolve(src2)
        elif op == 'DIV':
            if dst in regs:
                d = _resolve(src2)
                regs[dst] = int(_resolve(src1) / d) if d != 0 else 0
        elif op == 'MOD':
            if dst in regs:
                d = _resolve(src2)
                regs[dst] = int(_resolve(src1)) % int(d) if d != 0 else 0
        elif op == 'NEG':
            if dst in regs:
                regs[dst] = -_resolve(src1)
        elif op == 'AND':
            if dst in regs:
                regs[dst] = int(_resolve(src1)) & int(_resolve(src2))
        elif op == 'OR':
            if dst in regs:
                regs[dst] = int(_resolve(src1)) | int(_resolve(src2))
        elif op == 'NOT':
            if dst in regs:
                regs[dst] = ~int(_resolve(src1))
        elif op == 'XOR':
            if dst in regs:
                regs[dst] = int(_resolve(src1)) ^ int(_resolve(src2))
        elif op == 'SHL':
            if dst in regs:
                regs[dst] = int(_resolve(src1)) << int(_resolve(src2))
        elif op == 'SHR':
            if dst in regs:
                regs[dst] = int(_resolve(src1)) >> int(_resolve(src2))
        elif op == 'THROW':
            output.append(f"Exception thrown: {_resolve(src1)}")
            break
        elif op == 'ALLOC':
            heap_id = f"heap_{len(heap)}"
            heap[heap_id] = {'type': src1, 'value': None}
            if dst in regs:
                regs[dst] = heap_id
            output.append(f"alloc: {dst} = new {src1} → {heap_id}")
        elif op == 'FREE':
            ptr = _resolve(src1 or dst)
            if ptr in heap:
                del heap[ptr]
            output.append(f"free: delete {ptr}")
        elif op == 'PUSH':
            stack.append(_resolve(dst or src1))
        elif op == 'POP':
            if dst in regs:
                regs[dst] = stack.pop() if stack else 0
        elif op == 'CMP':
            try:
                cmp_result = float(_resolve(src1)) - float(_resolve(src2))
            except Exception:
                cmp_result = 0
        elif op == 'SETE':
            if dst in regs:
                regs[dst] = 1 if cmp_result == 0 else 0
        elif op == 'SETNE':
            if dst in regs:
                regs[dst] = 1 if cmp_result != 0 else 0
        elif op == 'SETL':
            if dst in regs:
                regs[dst] = 1 if cmp_result < 0 else 0
        elif op == 'SETG':
            if dst in regs:
                regs[dst] = 1 if cmp_result > 0 else 0
        elif op == 'SETLE':
            if dst in regs:
                regs[dst] = 1 if cmp_result <= 0 else 0
        elif op == 'SETGE':
            if dst in regs:
                regs[dst] = 1 if cmp_result >= 0 else 0
        elif op == 'JMP':
            jump = dst or src1
        elif op == 'JZ':
            if cmp_result == 0:
                jump = dst or src1
        elif op == 'JNZ':
            if cmp_result != 0:
                jump = dst or src1
        elif op == 'PRINT':
            raw = str(instr.get('_printVal') or dst or src1 or '').strip()
            if raw and raw != '—':
                if raw in ('\\n', '\n'):
                    output.append('↵')
                elif (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
                    output.append(raw[1:-1])
                elif raw in regs:
                    output.append(str(regs[raw]))
                elif raw.startswith('#'):
                    output.append(raw[1:])
                else:
                    output.append(raw)
        elif op == 'READ':
            if dst in regs:
                if input_idx < len(inputs):
                    val = inputs[input_idx]
                    input_idx += 1
                    if isinstance(val, str):
                        try:
                            val = int(val) if val.lstrip('-').isdigit() else float(val)
                        except Exception:
                            pass
                    regs[dst] = val
                else:
                    regs[dst] = 0
        elif op == 'CALL':
            call_stack.append(pc + 1)
            jump = dst or src1
        elif op == 'RET':
            if call_stack:
                ret = call_stack.pop()
                jump = ret
            else:
                halted = True

        if not halted:
            if jump is not None:
                resolved = _resolve_jump(jump)
                pc = resolved if resolved is not None else pc + 1
            else:
                pc += 1
            if pc >= len(instrs):
                halted = True

        changed = [r for r in regs if regs[r] != prev_regs.get(r)]
        trace.append(_snap(changed))
        steps += 1

    halted = True
    if not trace or not trace[-1]['halted']:
        trace.append(_snap())

    return jsonify({'trace': trace, 'steps': steps})


if __name__ == '__main__':
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    init_db()
    print("=" * 50)
    print("  VEC Bridge Server")
    print("=" * 50)
    print(f"  Compiler path : {COMPILER_PATH}")
    print(f"  Compiler found: {os.path.exists(COMPILER_PATH)}")
    print(f"  Database path : {DB_PATH}")
    print(f"  Allowed origins: {ALLOWED_ORIGINS}")
    print(f"  Server running: http://localhost:5000")
    print("=" * 50)
    # ── Fix 5: debug mode via env variable (never hardcode True) ───
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT",5000)),
        debug=debug_mode
    )
