import nltk
nltk.download("wordnet", quiet=True)
nltk.download("omw-1.4", quiet=True)

from nltk.corpus import wordnet


import sys
synonyms = []
for syn in wordnet.synsets(sys.argv[1]):
    for lm in syn.lemmas():
       synonyms.append(lm.name())
print (set(synonyms))

#if (len(sys.argv) > 2 and sys.argv[2] == 1):
import nlpaug.augmenter.word as naw
aug = naw.SpellingAug(dict_path=None, name='Spelling_Aug', aug_min=1, aug_max=10, aug_p=0.3, stopwords=None,
                    tokenizer=None, reverse_tokenizer=None, include_reverse=True, stopwords_regex=None, verbose=0)

synonyms.append(aug.augment(synonyms))
synonyms = [x.replace('_', '') for x in synonyms]
print(synonyms)


#python -m  pipreqs.pipreqs ./python --force
