FROM python:3.11-slim

RUN apt-get update && apt-get install -y g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r server/requirements.txt

RUN cd backend/src && g++ -std=c++17 -O2 -o vec \
    main.cpp lexer.cpp parser.cpp semantic.cpp \
    irgen.cpp optimizer.cpp codegen.cpp

EXPOSE 5000

CMD ["python", "server/server.py"]
