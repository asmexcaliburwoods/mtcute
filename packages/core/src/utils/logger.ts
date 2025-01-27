import { _defaultLoggingHandler } from './platform/logging'

let defaultLogLevel = 2
if (typeof process !== 'undefined') {
    const envLogLevel = parseInt(process.env.MTCUTE_LOG_LEVEL!)
    if (!isNaN(envLogLevel)) {
        defaultLogLevel = envLogLevel
    }
} else if (typeof localStorage !== 'undefined') {
    const localLogLevel = parseInt(localStorage.MTCUTE_LOG_LEVEL)
    if (!isNaN(localLogLevel)) {
        defaultLogLevel = localLogLevel
    }
}

const FORMATTER_RE = /%[a-zA-Z]/g

/**
 * Logger created by {@link LogManager}
 */
export class Logger {
    private color: number

    constructor(readonly mgr: LogManager, readonly tag: string) {
        let hash = 0

        for (let i = 0; i < tag.length; i++) {
            hash = (hash << 5) - hash + tag.charCodeAt(i)
            hash |= 0 // convert to 32bit int
        }

        this.color = Math.abs(hash) % 6
    }

    log(level: number, fmt: string, ...args: any[]): void {
        if (level > this.mgr.level) return

        // custom formatters
        if (
            fmt.indexOf('%h') > -1 ||
            fmt.indexOf('%b') > -1 ||
            fmt.indexOf('%j') > -1
        ) {
            let idx = 0
            fmt = fmt.replace(FORMATTER_RE, (m) => {
                if (m === '%h' || m === '%b' || m === '%j') {
                    const val = args[idx]

                    args.splice(idx, 1)
                    if (m === '%h') return val.toString('hex')
                    if (m === '%b') return !!val + ''
                    if (m === '%j') return JSON.stringify(val)
                }

                idx++

                return m
            })
        }

        this.mgr.handler(this.color, level, this.tag, fmt, args)
    }

    readonly error = this.log.bind(this, LogManager.ERROR)
    readonly warn = this.log.bind(this, LogManager.WARN)
    readonly info = this.log.bind(this, LogManager.INFO)
    readonly debug = this.log.bind(this, LogManager.DEBUG)
    readonly request = this.log.bind(this, LogManager.REQUEST)

    /**
     * Create a {@link Logger} with the given tag
     * from the same {@link LogManager} as the current
     * Logger.
     *
     * @param tag  Logger tag
     */
    create(tag: string): Logger {
        return this.mgr.create(tag)
    }
}

/**
 * Log manager.
 *
 * Does nothing by itself, but allows managing instance logs
 */
export class LogManager {
    static OFF = 0
    static ERROR = 1
    static WARN = 2
    static INFO = 3
    static DEBUG = 4
    static REQUEST = 5

    private _cache: Record<string, Logger> = {}

    level = defaultLogLevel
    handler = _defaultLoggingHandler

    disable(): void {
        this.level = 0
    }

    /**
     * Create a {@link Logger} with the given tag
     *
     * @param tag  Logger tag
     */
    create(tag: string): Logger {
        if (!(tag in this._cache)) {
            this._cache[tag] = new Logger(this, tag)
        }
        return this._cache[tag]
    }
}
