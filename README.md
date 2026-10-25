# Lotka — licznik do darta i bilarda na iPhone’a

Lotka liczy punkty w darcie i w bilardzie, losuje kolejność, rozdziela graczy na kilka tarcz albo stołów i prowadzi turnieje. Między kategoriami przełączasz się na stronie głównej. Działa jak zwykła aplikacja: z ikoną na ekranie początkowym, na pełnym ekranie i bez internetu. To aplikacja webowa (PWA), więc nie potrzebuje App Store ani Maca.

## Co potrafi

**Tryby gry**
- **X01**: 101 / 301 / 501 / 701, zamknięcie Double, Single albo Master Out, opcjonalnie Double In. Wpisywanie sumy tury albo każdej lotki osobno.
- **Cricket**: klasyczny i cut-throat.
- **Dookoła zegara**: od 1 do 20 i bull, opcjonalnie double i treble przeskakują pola.
- **Shanghai**: 7, 10 albo 20 rund. Single, double i treble w jednej turze to natychmiastowa wygrana. Remis rozstrzyga dogrywka na bullu.
- **Killer**: każdy losuje numer, po trafieniu własnego zostaje killerem i odbiera życia rywalom.

**Tryby bilardowe**
- **Ósemka**: bile do stukania, grupy (pełne/połówki) przypisują się same po rozbiciu, przy ósemce pytanie, kto wygrał partię.
- **Dziewiątka**: podświetlona najniższa bila na stole, wbicie dziewiątki kończy partię, zasada trzech fauli z rzędu.
- **Snooker**: 15, 10 albo 6 czerwonych. Punkty, aktualny brejk, punkty na stole, różnica, „potrzebne snookery”, faule 4–7, remis na czarnej.
- Gra do ustalonej liczby wygranych partii, rozbicie na zmianę albo przez zwycięzcę, statystyki: break & run, najdłuższa seria, najwyższy brejk.

**Gracze, kolejność i tarcze**
- Zapisana lista graczy z kolorami. Wybierasz, kto gra, albo dopisujesz nowe osoby w trakcie zakładania gry.
- Kolejność: animowane losowanie albo przeciąganie za uchwyt. W kolejnych legach zaczyna następny gracz.
- **1–4 tarcze albo stoły**: gracze dzielą się na tarcze/stoły (ręcznie albo losowo) i każde stanowisko gra swój mecz. Przełączasz się zakładkami.
- Legi i sety, np. „do 3 wygranych legów” albo „do 2 setów po 3 legi”.

**Turnieje**
- **Puchar**: drabinka z rozstawieniem i wolnymi losami, od 1/8 finału do finału.
- **Liga**: każdy z każdym, tabela z punktami i bilansem legów.
- Mecze turnieju idą równolegle na wszystkich tarczach. Wolna tarcza dostaje następną gotową parę.

**W trakcie gry**
- Podpowiedzi zamknięć (np. `T20 T20 BULL` przy 170), liczone dla tylu lotek, ile zostało w turze.
- Spiker po polsku: czyta wyniki tur, „Bust”, „Sto osiemdziesiąt!”, „Ania, zostało 40”.
- Dźwięki, animacje przy 180, bustach i wygranych, konfetti na koniec meczu.
- Cofanie dowolnej liczby rzutów, także po zakończonym meczu.
- Ekran nie wygasa w trakcie meczu. Gra zapisuje się na bieżąco i wraca po zamknięciu aplikacji.

**Statystyki**
- Średnia z 3 lotek, pierwsze 9, najwyższa tura, 180 / 140+ / 100+, zamknięcia, skuteczność na podwójnych, najlepszy leg, MPR w Cricketcie.
- Historia meczów, ranking graczy i profil każdego gracza z rekordami.
- Kopia zapasowa danych (kopiowanie do schowka i wczytywanie).

## Instalacja na iPhonie

1. W repozytorium na GitHubie otwórz **Settings → Pages**.
2. W **Build and deployment** wybierz **Deploy from a branch**, gałąź `main` (albo `claude/dart-scoring-app-73a7fw`, jeśli chcesz przed scaleniem) i folder **/ (root)**, potem **Save**.
3. Po minucie aplikacja będzie pod adresem **https://maciekradiant.github.io/loligiuszek/**.
4. Otwórz ten adres w **Safari** na iPhonie, stuknij **Udostępnij** i wybierz **Do ekranu początkowego**.

Od tej chwili Lotka uruchamia się z ikony i działa bez internetu. Gracze i wyniki są zapisane tylko na tym telefonie.

## Uruchomienie lokalnie

```sh
python3 -m http.server 8080   # albo: npm start
```

Potem otwórz http://localhost:8080. Aplikacja nie ma zależności ani kroku budowania.

Testy silnika punktacji (Node 18+):

```sh
npm test
```

## Struktura

```
index.html, manifest.webmanifest, sw.js   powłoka aplikacji, instalacja i tryb offline
css/app.css                               wygląd
js/engine/                                zasady gry: dart (modes.js), bilard (cue.js), statystyki, turnieje
js/views/                                 ekrany: start, nowa gra, gra (dart i bilard), gracze, wyniki, opcje
js/session.js                             tarcze i mecze jednej sesji
tests/                                    testy silnika
```

Mecz jest zapisany jako lista rzutów, a wynik, kolejka i statystyki są z niej odtwarzane. Dzięki temu cofanie jest dokładne, a niedokończona gra przetrwa zamknięcie aplikacji.

Po zmianie plików aplikacji podbij `VERSION` w `sw.js`, żeby telefony pobrały nową wersję.
