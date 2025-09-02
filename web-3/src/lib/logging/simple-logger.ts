// Simple logger that uses console.log directly
// This is a temporary solution to debug the logging issue

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class SimpleLogger {
  private module: string;
  
  constructor(module: string) {
    this.module = module;
  }
  
  private log(level: LogLevel, message: string, metadata?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.module}]`;
    
    if (metadata) {
      console.log(`${prefix} ${message}`, metadata);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
  
  debug(message: string, metadata?: any) {
    this.log('debug', message, metadata);
  }
  
  info(message: string, metadata?: any) {
    this.log('info', message, metadata);
  }
  
  warn(message: string, metadata?: any) {
    this.log('warn', message, metadata);
  }
  
  error(message: string, metadata?: any) {
    this.log('error', message, metadata);
  }
}

export function createSimpleLogger(module: string): SimpleLogger {
  return new SimpleLogger(module);
}