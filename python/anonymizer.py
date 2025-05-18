import re
from natasha import Segmenter, MorphVocab, NewsEmbedding, NewsNERTagger, Doc

segmenter = Segmenter()
morph_vocab = MorphVocab()
emb = NewsEmbedding()
ner_tagger = NewsNERTagger(emb)

labels = {
    "PER": "FULL_NAME",
    "LOC": "LOCATION",
    "ORG": "ORG",
    "DATE": "DATE",
    "TIME": "TIME",
    "MISC": "ENTITY"
}
def mask_entities(text):
    doc = Doc(text)
    doc.segment(segmenter)
    doc.tag_ner(ner_tagger)
    used = set()
    counts = {}
    for span in doc.spans:
        span.normalize(morph_vocab)
        lab = labels.get(span.type, span.type)
        counts[lab] = counts.get(lab, 0) + 1
        placeholder = f"<{lab}_{counts[lab]}>"
        if span.text not in used:
            text = text.replace(span.text, placeholder)
            used.add(span.text)
    return text

def mask_patterns(text):
    patterns = [
        (r'\b[\w\.-]+@[\w\.-]+\.\w+\b', '<EMAIL>'),
        (r'(?<!\d)(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}(?!\d)', '<PHONE>'),
        (r'\bИИН[\s:—-]*\d{12}\b', '<IIN>'),
        (r'\b\d{12}\b', '<IIN>'),
        (r'ID\s*№?\s*\d{6,}', '<PASSPORT>'),
        (r'паспорт.*?серии\s*\d+\s*№\s*\d+', '<PASSPORT>', re.IGNORECASE),
        (r'(?:д\.?\s*\d+[\w/]*[,]?\s*(?:кв\.?|квартира)\s*\d+|\d+\s*(?:кв\.?|квартира)\s*\d+)', '<ADDRESS>', re.IGNORECASE),
        (r'(улиц[аы]|проспект|переулок|проезд|шоссе)\s+[А-Яа-яёЁ\s\-]+', '<STREET>', re.IGNORECASE),
        (r'\d{6}(?=\D)', '<POSTAL_CODE>'),
        (r'@\w+', '<SOCIAL>'),
        (r'(https?://\S+|www\.\S+)', '<URL>'),
        (r'hh\.ru/resume/\S+', '<RESUME>'),
        (r'docs\.google\.com\S*', '<GOOGLE_DOC>'),
        (r'\b(?:\d[ -]*?){13,19}\b', '<CARD>'),
        (r'\b[АВЕКМНОРСТУХ]{1}\d{3}[АВЕКМНОРСТУХ]{2}\s?\d{2,4}\b', '<CAR>'),
        (r'ВУ\s*№?\s*\d{6,}', '<DRIVER_LICENSE>'),
        (r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '<IP_ADDRESS>'),
        (r'(?:ИБАН|IBAN)[\s:—-]*[A-Z]{2}\d{2}[A-Z0-9]{1,30}', '<IBAN>', re.IGNORECASE)
    ]
    for pat in patterns:
        if len(pat) == 2:
            text = re.sub(pat[0], pat[1], text)
        else:
            text = re.sub(pat[0], pat[1], text, flags=pat[2])
    return text

def anonymize(text):
    text = mask_patterns(text)
    text = mask_entities(text)
    return text

if __name__ == "__main__":
    txt = input("Введите текст для анонимизации:\n")
    print("\nРезультат:\n", flush=True)
    print(anonymize(txt), flush=True)