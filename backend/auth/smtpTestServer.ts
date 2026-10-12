import net, { type Server } from 'node:net';

export type SmtpTestServer = {
  port: number;
  messages: string[];
  close: () => Promise<void>;
};

/** Minimal local SMTP sink for tests; it never sends mail outside the test process. */
export async function startSmtpTestServer(): Promise<SmtpTestServer> {
  const messages: string[] = [];
  const server: Server = net.createServer(socket => {
    socket.setEncoding('utf8');
    socket.write('220 smart-time-local-test ESMTP\r\n');
    let buffer = '';
    let dataMode = false;
    let dataLines: string[] = [];
    let authStep: 'plain' | 'login-user' | 'login-pass' | null = null;

    socket.on('data', chunk => {
      buffer += String(chunk);
      while (true) {
        const newline = buffer.indexOf('\r\n');
        if (newline < 0) break;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);

        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            messages.push(dataLines.join('\n'));
            dataLines = [];
            socket.write('250 2.0.0 queued as smart-time-test\r\n');
          } else {
            dataLines.push(line.startsWith('..') ? line.slice(1) : line);
          }
          continue;
        }

        if (authStep === 'plain') {
          authStep = null;
          socket.write('235 2.7.0 authentication successful\r\n');
        } else if (authStep === 'login-user') {
          authStep = 'login-pass';
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (authStep === 'login-pass') {
          authStep = null;
          socket.write('235 2.7.0 authentication successful\r\n');
        } else if (/^(EHLO|HELO)\b/i.test(line)) {
          socket.write('250-smart-time-local-test\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10485760\r\n');
        } else if (/^AUTH PLAIN\s+\S+/i.test(line)) {
          socket.write('235 2.7.0 authentication successful\r\n');
        } else if (/^AUTH PLAIN$/i.test(line)) {
          authStep = 'plain';
          socket.write('334 \r\n');
        } else if (/^AUTH LOGIN/i.test(line)) {
          authStep = 'login-user';
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)\b/i.test(line)) {
          socket.write('250 2.1.0 OK\r\n');
        } else if (/^DATA$/i.test(line)) {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 2.0.0 OK\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw new Error('Could not determine local SMTP test port.');
  }
  return {
    port: address.port,
    messages,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
