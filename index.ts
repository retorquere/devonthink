import request = require('request-promise')
import md5 = require('md5')
import * as fs from 'fs'
import * as path from 'path'

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
  creators(creators) {
    return creators.map(author => author.literal || [ author.given, author.family ].filter(name => name).join(' ')).join(', ')
  }
  author(author) {
    return this.creators(author)
  }

  date(date) {
    return date['date-parts'][0].map(dp => `${dp}`).join('-')
  }
  issued(issued) {
    return this.date(issued)
  }
}

main(async () => {
  const config = process.argv[2]
    ? (process[2].argv.endsWidth('.json') ? require(process.argv[2]) : { collection: process.argv[2], output: process.argv[3], template: process.argv[4] })
    : require('./config.json')
  if (!config.template) config.template = 'template.html'
  if (!config.output) config.output = 'output'

  console.log(pkg.version, config)

  if (!config.template.endsWith('.html')) throw new Error(`Invalid template ${JSON.stringify(process.argv[3])}`)
  if (!config.collection || !config.collection.startsWith('http://') || !config.collection.endsWith('.csljson')) throw new Error(`invalid collection URL ${JSON.stringify(config.collection)}`)
  
  const template = fs.readFileSync(config.template, 'utf-8')
  const items = await request({ uri: config.collection, json: true })

  for (const item of items) {
    for (const [k, v] of Object.entries(item)) {
      if (!k.match(/^[a-z]+$/i)) {
        const _k = k.replace(/-(.)/g, (match, c) => c.toUpperCase())
        item[_k] = v
        delete item[k]
      }
    }

    for (const [k, v] of Object.entries(item)) {
      if (collapse[k]) item[k] = collapse[k](v)

      if (typeof item[k] !== 'string') console.log(k, v)
    }

    fs.writeFileSync(path.join(config.output, md5(JSON.stringify(item)) + '.html'), nunjucks.renderString(template, item))
  }
})
