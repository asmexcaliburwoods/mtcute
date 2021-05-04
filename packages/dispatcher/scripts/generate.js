const fs = require('fs')
const path = require('path')
const prettier = require('prettier')
const {
    snakeToCamel,
    camelToPascal,
    camelToSnake,
} = require('../../tl/scripts/common')

function parseUpdateTypes() {
    const lines = fs
        .readFileSync(path.join(__dirname, 'update-types.txt'), 'utf-8')
        .split('\n')
        .map((it) => it.trim())
        .filter((it) => it && it[0] !== '#')

    const ret = []

    for (const line of lines) {
        const m = line.match(/^([a-z_]+)(?:: ([a-zA-Z]+))? = ([a-zA-Z]+)$/)
        if (!m) throw new Error(`invalid syntax: ${line}`)
        ret.push({
            typeName: m[1],
            handlerTypeName: m[2] || camelToPascal(snakeToCamel(m[1])),
            updateType: m[3],
            funcName: m[2]
                ? m[2][0].toLowerCase() + m[2].substr(1)
                : snakeToCamel(m[1]),
        })
    }

    return ret
}

function replaceSections(filename, sections) {
    let lines = fs
        .readFileSync(path.join(__dirname, '../src', filename), 'utf-8')
        .split('\n')

    const findMarker = (marker) => {
        const idx = lines.findIndex((line) => line.trim() === `// ${marker}`)
        if (idx === -1) throw new Error(marker + ' not found')
        return idx
    }

    for (const [name, content] of Object.entries(sections)) {
        const start = findMarker(`begin-${name}`)
        const end = findMarker(`end-${name}`)

        if (start > end) throw new Error('begin is after end')

        lines.splice(start + 1, end - start - 1, content)
    }

    fs.writeFileSync(path.join(__dirname, '../src', filename), lines.join('\n'))
}

const types = parseUpdateTypes()

async function formatFile(filename) {
    const targetFile = path.join(__dirname, '../src/', filename)
    const prettierConfig = await prettier.resolveConfig(targetFile)
    let fullSource = await fs.promises.readFile(targetFile, 'utf-8')
    fullSource = await prettier.format(fullSource, {
        ...(prettierConfig || {}),
        filepath: targetFile,
    })
    await fs.promises.writeFile(targetFile, fullSource)
}

function toSentence(type, stype = 'inline') {
    const name = camelToSnake(type.handlerTypeName)
        .toLowerCase()
        .replace(/_/g, ' ')

    if (stype === 'inline') {
        return `${name[0].match(/[aeiouy]/i) ? 'an' : 'a'} ${name} handler`
    } else {
        return `${name[0].toUpperCase()}${name.substr(1)} handler`
    }
}

function generateBuilders() {
    const lines = []
    const imports = ['UpdateHandler']

    types.forEach((type) => {
        imports.push(`${type.handlerTypeName}Handler`)

        if (type.updateType === 'IGNORE') {
            lines.push(`
    /**
     * Create ${toSentence(type)}
     *
     * @param handler  ${toSentence(type, 'full')}
     */
    export function ${type.funcName}(
        handler: ${type.handlerTypeName}Handler['callback']
    ): ${type.handlerTypeName}Handler

    /**
     * Create ${toSentence(type)} with a filter
     *
     * @param filter  Predicate to check the update against
     * @param handler  ${toSentence(type, 'full')}
     */
    export function ${type.funcName}(
        filter: ${type.handlerTypeName}Handler['check'],
        handler: ${type.handlerTypeName}Handler['callback']
    ): ${type.handlerTypeName}Handler

    /** @internal */
    export function ${type.funcName}(filter: any, handler?: any): ${
                type.handlerTypeName
            }Handler {
        return _create('${type.typeName}', filter, handler)
    }
`)
        } else {
            lines.push(`
    /**
     * Create ${toSentence(type)}
     *
     * @param handler  ${toSentence(type, 'full')}
     */
    export function ${type.funcName}(
        handler: ${type.handlerTypeName}Handler['callback']
    ): ${type.handlerTypeName}Handler

    /**
     * Create ${toSentence(type)} with a filter
     *
     * @param filter  Update filter
     * @param handler  ${toSentence(type, 'full')}
     */
    export function ${type.funcName}<Mod>(
        filter: UpdateFilter<${type.updateType}, Mod>,
        handler: ${type.handlerTypeName}Handler<
            filters.Modify<${type.updateType}, Mod>
        >['callback']
    ): ${type.handlerTypeName}Handler

    /** @internal */
    export function ${type.funcName}(
        filter: any,
        handler?: any
    ): ${type.handlerTypeName}Handler {
        return _create('${type.typeName}', filter, handler)
    }
`)
        }
    })

    replaceSections('builders.ts', {
        codegen: lines.join('\n'),
        'codegen-imports':
            'import {\n' +
            imports.map((i) => `    ${i},\n`).join('') +
            "} from './handler'",
    })
}

function generateHandler() {
    const lines = []
    const names = ['RawUpdateHandler']

    // imports must be added manually because yeah

    types.forEach((type) => {
        if (type.updateType === 'IGNORE') return

        lines.push(
            `export type ${type.handlerTypeName}Handler<T = ${type.updateType}> = ParsedUpdateHandler<'${type.typeName}', T>`
        )
        names.push(`${type.handlerTypeName}Handler`)
    })

    replaceSections('handler.ts', {
        codegen:
            lines.join('\n') +
            '\n\nexport type UpdateHandler = \n' +
            names.map((i) => `    | ${i}\n`).join(''),
    })
}

function generateDispatcher() {
    const lines = []
    const imports = ['UpdateHandler']

    types.forEach((type) => {
        imports.push(`${type.handlerTypeName}Handler`)

        if (type.updateType === 'IGNORE') {
            lines.push(`
    /**
     * Register ${toSentence(type)} without any filters
     *
     * @param handler  ${toSentence(type, 'full')}
     * @param group  Handler group index
     */
    on${type.handlerTypeName}(handler: ${type.handlerTypeName}Handler['callback'], group?: number): void

    /**
     * Register ${toSentence(type)} with a filter
     *
     * @param filter  Update filter function
     * @param handler  ${toSentence(type, 'full')}
     * @param group  Handler group index
     */
    on${type.handlerTypeName}(
        filter: ${type.handlerTypeName}Handler['check'],
        handler: ${type.handlerTypeName}Handler['callback'],
        group?: number
    ): void

    /** @internal */
    on${type.handlerTypeName}(filter: any, handler?: any, group?: number): void {
        this._addKnownHandler('${type.funcName}', filter, handler, group)
    }
`)
        } else {
            lines.push(`
    /**
     * Register ${toSentence(type)} without any filters
     *
     * @param handler  ${toSentence(type, 'full')}
     * @param group  Handler group index
     * @internal
     */
    on${type.handlerTypeName}(handler: ${type.handlerTypeName}Handler['callback'], group?: number): void

    /**
     * Register ${toSentence(type)} with a filter
     *
     * @param filter  Update filter
     * @param handler  ${toSentence(type, 'full')}
     * @param group  Handler group index
     */
    on${type.handlerTypeName}<Mod>(
        filter: UpdateFilter<${type.updateType}, Mod>,
        handler: ${type.handlerTypeName}Handler<filters.Modify<${type.updateType}, Mod>>['callback'],
        group?: number
    ): void

    /** @internal */
    on${type.handlerTypeName}(filter: any, handler?: any, group?: number): void {
        this._addKnownHandler('${type.funcName}', filter, handler, group)
    }
`)
        }
    })

    replaceSections('dispatcher.ts', {
        codegen: lines.join('\n'),
        'codegen-imports':
            'import {\n' +
            imports.map((i) => `    ${i},\n`).join('') +
            "} from './handler'",
    })
}

async function main() {
    generateBuilders()
    generateHandler()
    generateDispatcher()

    await formatFile('builders.ts')
    await formatFile('handler.ts')
    await formatFile('dispatcher.ts')
}

main().catch(console.error)