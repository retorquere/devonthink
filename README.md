1. make sure you have node installed
2. run `npm install`
3. install BBT in Zotero. Right-click a collection or library and select "Show BibLaTeX server URL".
4. edit `config.json`. Paste the URL from step 3 into the field `collection` but change `.biblatex` into `.csljson`. Also paste the URL in your browser so you can see what the objects look like
5. edit `template.html`. The template understands [nunjucks](https://mozilla.github.io/nunjucks/) syntax; the objects it inserts are in CSL-JSON format, the fields of which are documented [here](https://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables). Variables with dashes (`-`) are available in camelCase in the template, so a variable like `container-title` is `containerTitle` in the template.
6. create a directory called `output` if it doesn't exist, or add a field called `output` to `config.json` pointing to the output directory
7. run `npm start`

You can see what data is available to the template by plugging the URL from step 3 into your browser. this script will make the following changes to what you see there:

1. `relations` is removed
2. `collections` is removed
3. if a `DOI` is present but starts with `https://doi.org/`, that prefix is stripped
4. `links` is the subset of `attachments` that are links to URL pages
5. `attachments` will have all `links` removed
6. a field named `select` will be added which is an URL that directly links into your Zotero library
7. `creators` will be changed into a single field listing all creators
8. `tags` will be changed into a single field listing all tags, sorted alphabetically
9. `notes` will be changed into a single field with all notes

Nunjucks will escape everything so that it is valid HTML; there is one special field called `notes` which is already valid HTML, so if you want this in the template, add it as `{{ notes | safe }}` so nunjucks doesn't escape it again
