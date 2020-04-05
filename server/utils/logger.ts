import { createLogger, format, transports } from 'winston';

const isProd = process.env.NODE_ENV === 'production';
const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.json(),
  transports: isProd
    ? [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
      ]
    : [
        new transports.Console({
          level: 'debug',
          format: format.combine(format.colorize(), format.simple()),
        }),
      ],
});

export default logger;
