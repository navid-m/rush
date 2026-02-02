import type { Server } from "bun";
import html from "../public/index.html?raw";

export class StaticFileServer {
    private server: Server | null = null;
    private port = 3000;
    private dataReady = false;
    private dataPromise: Promise<any> | null = null;

    async start(dataPromise?: Promise<any>): Promise<number> {
        if (dataPromise) {
            this.dataPromise = dataPromise;
            this.dataPromise
                .then(() => {
                    this.dataReady = true;
                })
                .catch(() => {
                    this.dataReady = true;
                });
        }

        const self = this;

        this.server = Bun.serve({
            port: this.port,
            async fetch(request) {
                const url = new URL(request.url);

                if (url.pathname === "/" || url.pathname === "/index.html") {
                    return new Response(html, {
                        headers: { "Content-Type": "text/html" },
                    });
                }

                if (url.pathname === "/commits-data.json") {
                    if (!self.dataReady && self.dataPromise) {
                        await self.dataPromise.catch(() => {});
                    }

                    try {
                        const file = Bun.file("./commits-data.json");
                        const exists = await file.exists();

                        if (exists) {
                            return new Response(await file.text(), {
                                headers: {
                                    "Content-Type": "application/json",
                                    "Cache-Control": "no-cache",
                                },
                            });
                        } else {
                            return new Response("Commit data not found", {
                                status: 404,
                            });
                        }
                    } catch (error: Error) {
                        return new Response("Internal server error", {
                            status: 500,
                        });
                    }
                }

                if (
                    url.pathname.startsWith("/assets/") ||
                    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/)
                ) {
                    try {
                        const filePath = `.${url.pathname}`;
                        const file = Bun.file(filePath);
                        const exists = await file.exists();

                        if (exists) {
                            let contentType = "application/octet-stream";

                            if (url.pathname.endsWith(".css"))
                                contentType = "text/css";
                            else if (url.pathname.endsWith(".js"))
                                contentType = "application/javascript";
                            else if (url.pathname.endsWith(".png"))
                                contentType = "image/png";
                            else if (
                                url.pathname.endsWith(".jpg") ||
                                url.pathname.endsWith(".jpeg")
                            )
                                contentType = "image/jpeg";
                            else if (url.pathname.endsWith(".gif"))
                                contentType = "image/gif";
                            else if (url.pathname.endsWith(".svg"))
                                contentType = "image/svg+xml";
                            else if (url.pathname.endsWith(".ico"))
                                contentType = "image/x-icon";

                            return new Response(await file.text(), {
                                headers: { "Content-Type": contentType },
                            });
                        } else {
                            return new Response("Asset not found", {
                                status: 404,
                            });
                        }
                    } catch (error: Error) {
                        return new Response("Internal server error", {
                            status: 500,
                        });
                    }
                }

                return new Response("Not found", { status: 404 });
            },
        });

        return this.port;
    }

    stop(): void {
        if (this.server) {
            this.server.stop();
        }
    }
}
