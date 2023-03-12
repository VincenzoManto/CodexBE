import nlpaug.augmenter.word as naw
import sys
aug = naw.SpellingAug(dict_path=None, name='Spelling_Aug', aug_min=1, aug_max=10, aug_p=0.3, stopwords=None,
                    tokenizer=None, reverse_tokenizer=None, include_reverse=True, stopwords_regex=None, verbose=0)

test_sentence_aug = aug.augment(sys.argv[1])
print(test_sentence_aug)
