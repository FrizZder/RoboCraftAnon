import sys
import json
import base64
import os
import subprocess
import datetime

def call_pytesseract(image_path):
    log_path = os.path.join(os.path.dirname(__file__), 'log_pytesseract.txt')
    proc = subprocess.Popen(
        [sys.executable, os.path.join(os.path.dirname(__file__), 'PyTesseract.py')],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    input_data = json.dumps({'imagePath': image_path}) + '\n'
    out, err = proc.communicate(input=input_data)
    out = out.strip()
    with open(log_path, 'a', encoding='utf-8') as log:
        log.write(f"\n--- {datetime.datetime.now()} ---\n")
        log.write(f"STDOUT:\n{out}\n")
        log.write(f"STDERR:\n{err}\n")
        log.write(f"RETURNCODE: {proc.returncode}\n")
    if proc.returncode == 0 and out:
        try:
            json.loads(out)
            return out
        except Exception:
            return json.dumps({'success': False, 'error': 'Invalid JSON from PyTesseract'})
    else:
        return json.dumps({'success': False, 'error': err.strip() or 'No output from PyTesseract'})

def call_readingfiles(file_path):
    log_path = os.path.join(os.path.dirname(__file__), 'log_readingfiles.txt')
    proc = subprocess.Popen(
        [sys.executable, os.path.join(os.path.dirname(__file__), 'readingFiles.py')],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    input_data = json.dumps({'filePath': file_path}) + '\n'
    out, err = proc.communicate(input=input_data)
    out = out.strip()
    with open(log_path, 'a', encoding='utf-8') as log:
        log.write(f"\n--- {datetime.datetime.now()} ---\n")
        log.write(f"STDOUT:\n{out}\n")
        log.write(f"STDERR:\n{err}\n")
        log.write(f"RETURNCODE: {proc.returncode}\n")
    if proc.returncode == 0 and out:
        try:
            result = json.loads(out)
            if result.get('success') and result.get('data'):
                output_path = result['data'].get('output_path')
                ext = result['data'].get('ext')
                
                if ext == '.pdf':
                    ext = '.txt'
                
                if output_path and os.path.exists(output_path):
                    with open(output_path, 'rb') as f:
                        data = f.read()
                    b64 = base64.b64encode(data).decode('utf-8')
                    return json.dumps({
                        'success': True,
                        'data': b64,
                        'ext': ext
                    })
            return out
        except Exception as e:
            return json.dumps({'success': False, 'error': f'Invalid JSON from readingFiles: {str(e)}'})
    else:
        return json.dumps({'success': False, 'error': err.strip() or 'No output from readingFiles'})

def main():
    try:
        input_data = json.loads(sys.stdin.readline())
        document_path = input_data.get('documentPath')
        ext = os.path.splitext(document_path)[1].lower()
        
        if ext in ['.jpg', '.jpeg', '.png']:
            print(call_pytesseract(document_path))
            return
        elif ext in ['.txt', '.docx', '.pdf']:
            print(call_readingfiles(document_path))
            return
        with open(document_path, 'rb') as f:
            data = f.read()
        b64 = base64.b64encode(data).decode('utf-8')
        print(json.dumps({
            'success': True,
            'data': b64,
            'ext': ext
        }))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main() 