# Resume source

`resume.tex` builds `assets/Muhammad_Memon_Resume.pdf`, the PDF offered in the Logbook. Keep it
in step with `CONTENT.resume` in `src/content.js`, which shows the same resume on the site.

Rebuild (needs a TeX distribution such as MacTeX):

    pdflatex -output-directory /tmp resume.tex && cp /tmp/resume.pdf ../assets/Muhammad_Memon_Resume.pdf

The resume must stay on one page: check the build log says "(1 page)".
This folder is listed in `.assetsignore`, so it is never published with the site.
