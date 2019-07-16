import request = require('request-promise')
import * as fs from 'fs'
import * as path from 'path'
import slug = require('slug')
import mkdirp = require('mkdirp')

import * as nunjucks from 'nunjucks'
nunjucks.configure({ autoescape: true })
const pkg = require('./package.json')

function main(asyncMain) {
  asyncMain()
    .then(exitCode => {
      process.exit(exitCode || 0)
    })
    .catch(err => {
      console.log('main failed:', err.stack)
      process.exit(1)
    })
}

const collapse = new class {
  public creators(creators) {
    return creators.map(creator => creator.name || [ creator.firstName, creator.lastName ].filter(name => name).join(' ')).join(', ')
  }

  public tags(tags) {
    return tags.map(tag => tag.tag).sort().join(', ')
  }

  public notes(notes) {
    return notes.map(note => `<div>${note}</div>`).join('\n\n')
  }

  public attachments(attachments) {
    return attachments.map(att => att.title).join(', ')
  }
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
  const config = process.argv[2]
    ? (process.argv[2].endsWith('.json') ? require(process.argv[2]) : { collection: process.argv[2], output: process.argv[3], template: process.argv[4] })
    : require('./config.json')
  if (!config.template) config.template = 'template.html'
  if (!config.output) config.output = 'output'

  if (!config.template.endsWith('.html')) throw new Error(`Invalid template ${JSON.stringify(process.argv[3])}`)

  let library: ILibrary
  if (!config.collection) throw new Error('No collection')
  if (config.collection.startsWith('http://')) {
    if (!config.collection.endsWith('.json')) throw new Error(`invalid collection URL ${JSON.stringify(config.collection)}`)
    library = await request({ uri: config.collection, json: true })
  } else {
    if (!fs.existsSync(config.collection)) throw new Error(`${JSON.stringify(config.collection)} does not exist`)
    library = JSON.parse(fs.readFileSync(config.collection, 'utf8'))
  }

  config.maxlength = config.maxlength || 20

  function filename(name) {
    return slug(name || '', ' ').substr(0, config.maxlength)
  }

  console.log(pkg.version, config)

  const template = fs.readFileSync(config.template, 'utf-8')

  function write(item, _path) {
    _path = path.join(config.output, _path)
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

  for (const item of library.items) {
    delete item.relations

    for (const [k, v] of Object.entries(item)) {
      if (Array.isArray(v) && !v.length) {
        delete item[k]
        continue
      }

      if (collapse[k]) item[k] = collapse[k](v)

      if (typeof item[k] !== 'string' && typeof item[k] !== 'number') console.log(k, v)
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
