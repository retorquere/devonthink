import request = require('request-promise')
import * as fs from 'fs'
import * as path from 'path'
import slug = require('slug')
import mkdirp = require('mkdirp')
import alert = require('alert-node')
import program = require('commander')

import * as nunjucks from 'nunjucks'
nunjucks.configure({ autoescape: true })
const pkg = require('./package.json')

function main(asyncMain) {
  asyncMain()
    .then(exitCode => {
      process.exit(exitCode || 0)
    })
    .catch(err => {
      console.log(err.message)
      alert(err.message)
      process.exit(1)
    })
}

const collapse = new class {
  public creators(creators) {
    return creators.map(creator => creator.name || [ creator.firstName, creator.lastName ].filter(name => name).join(' ')).join(', ')
  }

  public tags(tags) {
    return tags.sort().join(', ')
  }

  public notes(notes) {
    return notes.map(note => `<div>${note}</div>`).join('\n\n')
  }

  /*
  public attachments(attachments) {
    return attachments.map(att => att.title).join(', ')
  }
  */
}

interface ICollection {
  id: number
  key: string
  parent: false | string
  name: string
  items: number[],
  collections: string[]
  path: string
}
interface ILibrary {
  collections: { [key: string]: ICollection }
  items: any[]
}

main(async () => {
  // config
  let defaults: any = [ (process.argv.length > 2 && process.argv[process.argv.length - 1]), 'config.json', 'config.json.sample' ].find(cfg => cfg && fs.existsSync(cfg))
  defaults = defaults ? JSON.parse(fs.readFileSync(defaults, 'utf8')) : {}
  defaults.template = defaults.template || [ 'template.html', 'template.html.sample' ].find(tmpl => fs.existsSync(tmpl))

  program
    .version(pkg.version, '-v, --version')
    .option('-t, --template [file]', 'template to use', defaults.template)
    .option('-o, --output [dir]', 'output folder', defaults.output || 'output')
    .option('-c, --collection <url>', 'Zotero library/collection URL', defaults.collection)
    .option('-m, --maxlength [n]', 'Cut off file paths at n characters', defaults.maxlength || 20)
    .parse(process.argv)

  if (!fs.existsSync(program.template)) throw new Error(`${JSON.stringify(program.template)} does not exist`)
  const template = fs.readFileSync(program.template, 'utf-8')

  if (!program.collection) throw new Error('no collection URL')
  let library: ILibrary
  if (program.collection.startsWith('http')) {
    if (!program.collection.endsWith('.json')) throw new Error(`invalid collection URL ${JSON.stringify(program.collection)}`)
    library = await request({ uri: program.collection, json: true })
  } else {
    if (!fs.existsSync(program.collection)) throw new Error(`${JSON.stringify(program.collection)} does not exist`)
    library = JSON.parse(fs.readFileSync(program.collection, 'utf8'))
  }

  const config = {}
  for (let option of program.options) {
    option = option.long.replace('--', '')
    if (option === 'version') continue
    config[option] = program[option]
  }
  console.log(pkg.version, config)

  // helper functions
  function filename(name) {
    return slug(name || '', ' ').substr(0, program.maxlength)
  }

  function write(item, _path) {
    _path = path.join(program.output, _path)
    mkdirp.sync(_path)
    fs.writeFileSync(path.join(_path, filename(item.title) + '.html'), item.html)
    item.written = true
  }

  function resolveCollection(coll: ICollection, _path) {
    coll.path = path.join(_path, filename(coll.name))

    if (coll.items) {
      for (const item of library.items.filter(i => coll.items.includes(i.itemID))) {
        write(item, coll.path)
      }
    }

    for (const child of coll.collections || []) {
      resolveCollection(library.collections[child], coll.path)
    }
  }

  // main
  const DOIprefix = 'https://doi.org/'
  for (const item of library.items) {
    delete item.relations
    delete item.collections

    if (item.DOI && item.DOI.startsWith(DOIprefix)) item.DOI = item.DOI.substr(DOIprefix.length)

    item.links = (item.attachments || []).filter(link => link.linkMode === 'linked_url' && link.url)
    item.attachments = (item.attachments || []).filter(link => link.linkMode !== 'linked_url')

    item.select = `zotero://select/items/${item.libraryID}_${item.key}`

    for (const [k, v] of Object.entries(item)) {
      if (Array.isArray(v) && !v.length) {
        delete item[k]
        continue
      }

      if (collapse[k]) item[k] = collapse[k](v)

      if (k !== 'attachments' && k !== 'links' && typeof item[k] !== 'string' && typeof item[k] !== 'number') console.log(k, v)
    }

    item.html = nunjucks.renderString(template, item)
  }

  for (const coll of Object.values(library.collections).filter(c => !c.parent)) {
    resolveCollection(coll, '')
  }

  for (const item of library.items.filter(i => !i.written)) {
    write(item, '')
  }
})
