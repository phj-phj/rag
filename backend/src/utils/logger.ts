import winston from 'winston'

const DEBUG_AI = process.env.DEBUG_AI === 'true'
const isProduction = process.env.NODE_ENV === 'production'

const devPrintf = winston.format.printf(
  ({ timestamp, level, message, module, ...rest }) => {
    const moduleStr = module ? ` [${module}]` : ''
    const metaKeys = Object.keys(rest).filter(
      k => !['timestamp', 'service'].includes(k),
    )
    const metaStr = metaKeys.length > 0 ? ' ' + JSON.stringify(rest) : ''
    return `${timestamp} ${level}:${moduleStr} ${message}${metaStr}`
  },
)

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      ...(isProduction
        ? [winston.format.json()]
        : [winston.format.colorize(), devPrintf]),
    ),
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.json(),
    options: { flags: 'a' },
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.json(),
    options: { flags: 'a' },
  }),
]

if (DEBUG_AI) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/ai-debug.log',
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        devPrintf,
      ),
      options: { flags: 'a' },
    }),
  )
}

const baseLogger = winston.createLogger({
  level: DEBUG_AI ? 'debug' : process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ),
  defaultMeta: { service: 'papier-api' },
  transports,
})

export function createModuleLogger(module: string): winston.Logger {
  return baseLogger.child({ module })
}

export const logger = baseLogger
