import sys
import nlpaug.augmenter.char as nac
import nlpaug.augmenter.word as naw

words = sys.argv[2:]
language = sys.argv[1] or 'it'
language2 = 'ita' if language == 'it'else language



syn = naw.SynonymAug(aug_src='wordnet', model_path=None, name='Synonym_Aug', lang=language2,
                     verbose=0)

finalWords = []
for word in words:
    finalWords.extend(syn.augment(word, 2))


key = nac.KeyboardAug(name='Keyboard_Aug', lang=str(language), verbose=0)
finalWords3 = finalWords
for word in words:
    finalWords3.append(key.augment(word))

print(finalWords3)