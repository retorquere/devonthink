1. make sure you have node installed
2. run `npm install`
3. install BBT in Zotero. Right-click a collection or library and select "Show BibLaTeX server URL".
4. edit `config.json`. Paste the URL from step 3 into the field `collection` but change `.biblatex` into `.csljson`. Also paste the URL in your browser so you can see what the objects look like
5. edit `template.html`. The exported objects are in CSL-JSON format, the fields of which are documented [here](https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables). Variables with dashes (`-`) are available in camelCase in the template, so a variable like `container-title` is `containerTitle` in the template.
6. create a directory called `output` if it doesn't exist, or add a field called `output` to `config.json` pointing to the output directory
7. run `npm start`
