import cv2
import pytesseract
from anonymizer import anonymize
import difflib
import os
import json
import base64
from io import BytesIO
import sys
import numpy as np

pytesseract.pytesseract.tesseract_cmd = r'C:\Users\ASUS\Documents\case2UI\python\Tesseract-OCR\tesseract.exe'

class ImageAnonymizer:
    def __init__(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.face_model_path = os.path.join(base_dir, "res10_300x300_ssd_iter_140000.caffemodel")
        self.face_config_path = os.path.join(base_dir, "deploy.prototxt")
        
        self.face_net = None
        self.initialize_face_detection()

    def initialize_face_detection(self):
        try:
            if not os.path.exists(self.face_config_path):
                print(f"Error: Config file not found at {self.face_config_path}", file=sys.stderr)
                self.face_net = None
                return
            if not os.path.exists(self.face_model_path):
                print(f"Error: Model file not found at {self.face_model_path}", file=sys.stderr)
                self.face_net = None
                return
                
            self.face_net = cv2.dnn.readNetFromCaffe(self.face_config_path, self.face_model_path)
        except Exception as e:
            print(f"Error initializing face detection: {str(e)}", file=sys.stderr)
            self.face_net = None

    def process_image(self, image_path, languages='rus+eng'):
        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()
            nparr = np.frombuffer(img_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return {
                    'success': False,
                    'error': f'Failed to load image from {image_path} (cv2.imdecode returned None)'
                }

            text_result = self.process_text(image, languages) 
            face_result = self.process_faces(text_result['image'])

            result_image = face_result['image'] 
            result_base64 = self.image_to_base64(result_image)

            return {
                'success': True,
                'original_text': text_result['original_text'],
                'anonymized_text': text_result['anonymized_text'],
                'image': result_base64,
                'faces_detected': face_result['faces_detected']
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


    def process_text(self, image, languages):
        result_image = image.copy()

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        original_text = pytesseract.image_to_string(gray, lang=languages)
        anonymized_text = anonymize(original_text)

        data = pytesseract.image_to_data(gray, lang=languages, output_type=pytesseract.Output.DICT)

        words_with_indices = []
        for i, word in enumerate(data['text']):
            word = word.strip()
            if word:
                words_with_indices.append((word, i))

        original_words = [w for (w, _) in words_with_indices]
        anonymized_words = anonymized_text.strip().split()

        matcher = difflib.SequenceMatcher(None, original_words, anonymized_words)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                for _, word_index in words_with_indices[i1:i2]:
                    x = data['left'][word_index]
                    y = data['top'][word_index]
                    w = data['width'][word_index]
                    h = data['height'][word_index]
                    cv2.rectangle(result_image, (x, y), (x + w, y + h), (0, 0, 0), -1)

        return {
            'image': result_image,
            'original_text': original_text,
            'anonymized_text': anonymized_text
        }

    def process_faces(self, image):
        if self.face_net is None:
            return {
                'image': image,
                'faces_detected': 0
            }

        faces_detected = 0
        result_image = image.copy()
        h, w = image.shape[:2]

        blob = cv2.dnn.blobFromImage(image, 1.0, (300, 300), (104.0, 177.0, 123.0))
        self.face_net.setInput(blob)
        detections = self.face_net.forward()

        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.6:
                faces_detected += 1
                box = detections[0, 0, i, 3:7] * [w, h, w, h]
                (x1, y1, x2, y2) = box.astype("int")

                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                face = result_image[y1:y2, x1:x2]
                if face.size > 0:
                    small = cv2.resize(face, (16, 16), interpolation=cv2.INTER_LINEAR)
                    mosaic = cv2.resize(small, (x2 - x1, y2 - y1), interpolation=cv2.INTER_NEAREST)
                    result_image[y1:y2, x1:x2] = mosaic

        return {
            'image': result_image,
            'faces_detected': faces_detected
        }

    def image_to_base64(self, image):
        _, buffer = cv2.imencode('.jpg', image)
        return base64.b64encode(buffer).decode('utf-8')

def process_image_file(image_path, languages='rus+eng'):
    anonymizer = ImageAnonymizer()
    return anonymizer.process_image(image_path, languages)

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.readline())
        image_path = input_data.get('imagePath')
        
        if not image_path:
            print(json.dumps({
                'success': False,
                'error': 'No image path provided'
            }))
            sys.exit(1)
        
        ext = os.path.splitext(image_path)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png']:
            print(json.dumps({
                'success': False,
                'error': 'Unsupported file format'
            }))
            sys.exit(1)
        
        result = process_image_file(image_path)
        if result.get('success') and result.get('image'):
            print(json.dumps({
                'success': True,
                'data': result['image'],
                'ext': ext if ext != '.jpeg' else '.jpg'
            }))
        else:
            print(json.dumps({
                'success': False,
                'error': result.get('error', 'Unknown error')
            }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)