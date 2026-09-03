import { Request, Response, NextFunction } from 'express';

const XSS_PATTERNS: RegExp[] = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*\/?>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /on(?:load|error|click|mouseover|mouseout|focus|blur|change|submit|reset|select|keydown|keypress|keyup|mousedown|mouseup|mousemove|mouseenter|mouseleave|contextmenu|dblclick|wheel|scroll|resize|abort|unload|beforeunload|hashchange|popstate|storage|message|online|offline|pagehide|pageshow|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|copy|cut|paste|animationstart|animationend|animationiteration|transitionstart|transitionend|transitionrun|transitioncancel)\s*=/gi,
  /document\.(?:cookie|location|write|domain|open|getElementById|getElementsByClassName|getElementsByTagName|querySelector|querySelectorAll|createElement|createTextNode|appendChild|removeChild|replaceChild|innerHTML|outerHTML|insertBefore|addEventListener|attachEvent)/gi,
  /window\.(?:location|open|alert|confirm|prompt|eval|setTimeout|setInterval|postMessage|localStorage|sessionStorage|document|parent|top|self|frames)/gi,
  /eval\s*\(/gi,
  /new\s+Function\s*\(/gi,
  /setTimeout\s*\(\s*['"]/gi,
  /setInterval\s*\(\s*['"]/gi,
  /<\s*iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<\s*iframe[^>]*\/?>/gi,
  /<\s*object[^>]*>[\s\S]*?<\/object>/gi,
  /<\s*embed[^>]*\/?>/gi,
  /<\s*svg[^>]*>[\s\S]*?<\/svg>/gi,
  /<\s*form[^>]*action\s*=\s*['"][^>]*javascript\s*:/gi,
  /<\s*img[^>]*src\s*=\s*['"][^>]*data\s*:\s*image\s*\/[^>]*;.*base64[^>]*onerror\s*=/gi,
  /data\s*:\s*(?:text|application)\/(?:html|xml|xhtml|svg|javascript)[;,]/gi,
  /base64\s*,\s*[A-Za-z0-9+/=]{100,}/gi,
  /%3Cscript[^%]*%3E/gi,
  /&#x?0*(?:60|3c|61|3d|62|3e|3a|40|58|73|72|63|69|70|74);/gi,
  /\\x3c[^\\]*\\x3e/gi,
  /\\u003c[^\\]*\\u003e/gi,
  /\$\{[^}]*\}/g,
];

const NOSQL_INJECTION_PATTERNS: RegExp[] = [
  /\$where\s*:/gi,
  /\{\s*\$ne\s*:/gi,
  /\{\s*\$gt\s*:/gi,
  /\{\s*\$lt\s*:/gi,
  /\{\s*\$gte\s*:/gi,
  /\{\s*\$lte\s*:/gi,
  /\{\s*\$in\s*:/gi,
  /\{\s*\$nin\s*:/gi,
  /\{\s*\$regex\s*:/gi,
  /\{\s*\$exists\s*:/gi,
  /\{\s*\$type\s*:/gi,
  /\{\s*\$mod\s*:/gi,
  /\{\s*\$text\s*:/gi,
  /\{\s*\$where\s*:/gi,
  /\{\s*\$all\s*:/gi,
  /\{\s*\$size\s*:/gi,
  /\{\s*\$elemMatch\s*:/gi,
  /\"\s*\$where\s*\"\s*:/gi,
  /'\s*\$where\s*'\s*:/gi,
  /\{\s*\$or\s*:\s*\[/gi,
  /\{\s*\$and\s*:\s*\[/gi,
  /\{\s*\$nor\s*:\s*\[/gi,
  /\{\s*\$not\s*:/gi,
];

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|UNION|SCRIPT)\b)/gi,
  /\bOR\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]/gi,
  /\bAND\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]/gi,
  /(--|#|\/\*|\*\/|;)/g,
  /\bUNION\s+(?:ALL\s+)?SELECT\b/gi,
  /\bDROP\s+(?:TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|SCHEMA)\b/gi,
  /\b(?:xp_|sp_)[a-zA-Z_]+/gi,
  /'/g,
];

function sanitizeString(input: string, depth: number = 0): string {
  if (typeof input !== 'string') return input;
  if (depth > 5) return '';

  let sanitized = input;
  let prevSanitized: string;

  do {
    prevSanitized = sanitized;

    for (const pattern of XSS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_XSS]');
    }

    for (const pattern of NOSQL_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_NOSQL]');
    }

    sanitized = sanitized
      .replace(/\0/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  } while (sanitized !== prevSanitized);

  sanitized = sanitized.replace(/\[REDACTED_XSS\](?:\s*\[REDACTED_XSS\])*/g, '[REDACTED_XSS]');
  sanitized = sanitized.replace(/\[REDACTED_NOSQL\](?:\s*\[REDACTED_NOSQL\])*/g, '[REDACTED_NOSQL]');

  return sanitized;
}

function sanitizeValue(value: any, depth: number = 0): any {
  if (depth > 10) return undefined;
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return sanitizeString(value, depth);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      const cleanKey = sanitizeString(String(key), depth);
      const hasNoSqlInKey = key.startsWith('$') || key.includes('.');
      if (hasNoSqlInKey) {
        sanitizedObj[`safe_${cleanKey.replace(/[\$.]/g, '_')}`] = sanitizeValue(val, depth + 1);
      } else {
        sanitizedObj[cleanKey] = sanitizeValue(val, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return value;
}

function containsBlockedContent(value: any, depth: number = 0): { blocked: boolean; reason?: string; pattern?: string } {
  if (depth > 10) return { blocked: false };
  if (value === null || value === undefined) return { blocked: false };

  if (typeof value === 'string') {
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(value)) {
        pattern.lastIndex = 0;
        return { blocked: true, reason: 'Potential XSS payload detected', pattern: pattern.toString() };
      }
    }
    for (const pattern of NOSQL_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        pattern.lastIndex = 0;
        return { blocked: true, reason: 'Potential NoSQL injection payload detected', pattern: pattern.toString() };
      }
    }
    return { blocked: false };
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { blocked: false };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = containsBlockedContent(item, depth + 1);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }

  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$')) {
        return { blocked: true, reason: 'NoSQL operator in object key', pattern: `$key: ${key}` };
      }
      if (key.includes('.')) {
        return { blocked: true, reason: 'Nested key operator detected', pattern: `. in key: ${key}` };
      }
      const result = containsBlockedContent(val, depth + 1);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }

  return { blocked: false };
}

export const sanitizeInput = (strictMode: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body) {
        const bodyCheck = containsBlockedContent(req.body);
        if (strictMode && bodyCheck.blocked) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Malicious content detected in request body',
            details: {
              reason: bodyCheck.reason,
              field: 'body'
            },
            code: 'SANITIZATION_BLOCKED',
            timestamp: new Date().toISOString()
          });
        }
        req.body = sanitizeValue(req.body);
      }

      if (req.query && Object.keys(req.query).length > 0) {
        const queryCheck = containsBlockedContent(req.query);
        if (strictMode && queryCheck.blocked) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Malicious content detected in query parameters',
            details: {
              reason: queryCheck.reason,
              field: 'query'
            },
            code: 'SANITIZATION_BLOCKED',
            timestamp: new Date().toISOString()
          });
        }
        res.locals.sanitizedQuery = sanitizeValue(req.query);
      }

      if (req.params && Object.keys(req.params).length > 0) {
        const paramsCheck = containsBlockedContent(req.params);
        if (strictMode && paramsCheck.blocked) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Malicious content detected in URL parameters',
            details: {
              reason: paramsCheck.reason,
              field: 'params'
            },
            code: 'SANITIZATION_BLOCKED',
            timestamp: new Date().toISOString()
          });
        }
        res.locals.sanitizedParams = sanitizeValue(req.params);
      }

      if (req.headers) {
        const criticalHeaders = ['authorization', 'x-api-key', 'x-auth-token', 'x-requested-with'];
        for (const header of criticalHeaders) {
          if (req.headers[header]) {
            const headerVal = String(req.headers[header]);
            const headerCheck = containsBlockedContent(headerVal);
            if (strictMode && headerCheck.blocked) {
              return res.status(400).json({
                status: 'error',
                statusCode: 400,
                error: 'Bad Request',
                message: `Malicious content detected in header: ${header}`,
                code: 'SANITIZATION_BLOCKED',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      if (req.file) {
        const metadataToCheck = {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          encoding: req.file.encoding
        };
        const fileCheck = containsBlockedContent(metadataToCheck);
        if (strictMode && fileCheck.blocked) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            error: 'Bad Request',
            message: 'Malicious content detected in file upload metadata',
            details: {
              reason: fileCheck.reason
            },
            code: 'SANITIZATION_BLOCKED',
            timestamp: new Date().toISOString()
          });
        }
      }

      next();
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Sanitization processing error',
        code: 'SANITIZATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
};

export const xssSanitize = sanitizeString;
export const deepSanitize = sanitizeValue;
export const checkBlockedContent = containsBlockedContent;
