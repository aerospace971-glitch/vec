from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import tempfile
import json
import os

app = Flask(__name__)
CORS(app)

# Path to your compiled vec.exe
# Update this path if your binary is somewhere else
COMPILER_PATH = os.path.join(
    os.path.dirname(__file__),
    '..', 'backend', 'src', 'vec.exe'
)

def run_compiler(source: str, phase: str = 'all') -> dict:
    # Write source to a temp file
    with tempfile.NamedTemporaryFile(
        suffix='.cpp', mode='w',
        delete=False, encoding='utf-8'
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
        except:
            pass


@app.route('/health', methods=['GET'])
def health():
    compiler_exists = os.path.exists(COMPILER_PATH)
    return jsonify({
        'status':          'ok',
        'compiler_found':  compiler_exists,
        'compiler_path':   COMPILER_PATH
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


@app.route('/phases', methods=['GET'])
def list_phases():
    return jsonify({
        'phases': ['lex', 'parse', 'semantic', 'ir', 'opt', 'codegen', 'all']
    })


if __name__ == '__main__':
    print("=" * 50)
    print("  VEC Bridge Server")
    print("=" * 50)
    print(f"  Compiler path : {COMPILER_PATH}")
    print(f"  Compiler found: {os.path.exists(COMPILER_PATH)}")
    print(f"  Server running: http://localhost:5000")
    print("=" * 50)
    app.run(port=5000, debug=True)