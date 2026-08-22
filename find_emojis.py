import os
import sys

def find_emojis():
    for root, dirs, files in os.walk('frontend/src'):
        for file in files:
            if file.endswith('.jsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        # Find characters > 8000 (usually emojis or special symbols)
                        if any(ord(c) > 8000 for c in line) and 'import' not in line:
                            # print safely
                            sys.stdout.buffer.write(f"{path}:{i+1}:{line.strip()}\n".encode('utf-8'))

if __name__ == '__main__':
    find_emojis()
