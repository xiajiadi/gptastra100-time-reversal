# Local static server for preview / offline rendering (ASCII only: PS 5.1 reads BOM-less files as ANSI)
#   GET  /path                         -> static file (Range supported)
#   POST /__save?path=..&append=0|1    -> write request body to a file inside the project folder
#   GET  /__log?m=..                   -> print a line to the console and tools/render.log
param([int]$Port = 8766, [string]$Root = '')
if (-not $Root) { $Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }

$src = @'
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

public class MvServer2 {
    string root; HttpListener l; string logFile;
    public MvServer2(string root, int port) {
        this.root = Path.GetFullPath(root);
        logFile = Path.Combine(this.root, "tools", "render.log");
        l = new HttpListener();
        l.Prefixes.Add("http://localhost:" + port + "/");
    }
    public void Run() {
        l.Start();
        Console.WriteLine("serving " + root);
        while (true) {
            HttpListenerContext c = l.GetContext();
            ThreadPool.QueueUserWorkItem(delegate { try { Handle(c); } catch (Exception e) { try { c.Response.Abort(); } catch { } Console.WriteLine("ERR " + e.Message); } });
        }
    }
    static string Mime(string p) {
        switch (Path.GetExtension(p).ToLowerInvariant()) {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json";
            case ".wav": return "audio/wav";
            case ".aac": return "audio/aac";
            case ".m4a": return "audio/mp4";
            case ".mp4": return "video/mp4";
            case ".png": return "image/png";
            case ".jpg": return "image/jpeg";
            case ".txt": return "text/plain; charset=utf-8";
            case ".ttf": return "font/ttf";
            case ".webp": return "image/webp";
            default: return "application/octet-stream";
        }
    }
    string Resolve(string rel) {
        string full = Path.GetFullPath(Path.Combine(root, rel.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new Exception("bad path");
        return full;
    }
    void Handle(HttpListenerContext c) {
        HttpListenerRequest q = c.Request; HttpListenerResponse r = c.Response;
        r.Headers["Cache-Control"] = "no-store";
        string path = Uri.UnescapeDataString(q.Url.AbsolutePath);
        if (path == "/__log") {
            string m = q.QueryString["m"] ?? "";
            string line = DateTime.Now.ToString("HH:mm:ss") + " " + m;
            Console.WriteLine(line);
            lock (this) { File.AppendAllText(logFile, line + "\r\n", Encoding.UTF8); }
            r.StatusCode = 204; r.Close(); return;
        }
        if (path == "/__save" && q.HttpMethod == "POST") {
            string rawQ = q.Url.Query.TrimStart('?'); string pv = ""; string ap = "";
            foreach (string kv in rawQ.Split('&')) { int eq = kv.IndexOf('='); if (eq < 0) continue; string kk = kv.Substring(0, eq), vv = Uri.UnescapeDataString(kv.Substring(eq + 1).Replace("+", " ")); if (kk == "path") pv = vv; if (kk == "append") ap = vv; }
            string full = Resolve(pv);
            string output = Path.Combine(root, "out") + Path.DirectorySeparatorChar;
            if (!full.StartsWith(output, StringComparison.OrdinalIgnoreCase)) {
                r.StatusCode = 403; r.Close(); return;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(full));
            bool append = ap == "1";
            lock (this) {
                using (FileStream fs = new FileStream(full, append ? FileMode.Append : FileMode.Create, FileAccess.Write)) q.InputStream.CopyTo(fs);
            }
            r.StatusCode = 204; r.Close(); return;
        }
        if (path == "/") path = "/index.html";
        string file = Resolve(path);
        if (!File.Exists(file)) { r.StatusCode = 404; r.Close(); return; }
        using (FileStream fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
            long len = fs.Length, start = 0, end = len - 1;
            r.ContentType = Mime(file);
            r.Headers["Accept-Ranges"] = "bytes";
            string range = q.Headers["Range"];
            if (range != null && range.StartsWith("bytes=")) {
                string[] p = range.Substring(6).Split('-');
                if (p[0] != "") start = long.Parse(p[0]);
                if (p.Length > 1 && p[1] != "") end = Math.Min(len - 1, long.Parse(p[1]));
                r.StatusCode = 206;
                r.Headers["Content-Range"] = "bytes " + start + "-" + end + "/" + len;
            }
            r.ContentLength64 = end - start + 1;
            fs.Position = start;
            byte[] buf = new byte[1 << 16]; long left = end - start + 1;
            try {
                while (left > 0) {
                    int n = fs.Read(buf, 0, (int)Math.Min(buf.Length, left));
                    if (n <= 0) break;
                    r.OutputStream.Write(buf, 0, n); left -= n;
                }
                r.Close();
            } catch { try { r.Abort(); } catch { } }
        }
    }
}
'@
Add-Type -TypeDefinition $src -Language CSharp
(New-Object MvServer2($Root, $Port)).Run()
