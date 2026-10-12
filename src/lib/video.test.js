import { describe, it, expect } from "vitest";
import { extraireIdYoutube, extraireIdVimeo, urlIntegration, cheminVideo, validerUrlDirecte } from "./video.js";

describe("extraireIdYoutube", () => {
  it.each([
    ["dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?list=x&v=dQw4w9WgXcQ&t=10"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ"],
  ])("%s", (url) => expect(extraireIdYoutube(url)).toBe("dQw4w9WgXcQ"));
  it("rejette une URL non YouTube", () => expect(extraireIdYoutube("https://exemple.fr")).toBeNull());
});

describe("extraireIdVimeo", () => {
  it("lit un id simple ou une URL", () => {
    expect(extraireIdVimeo("123456")).toBe("123456");
    expect(extraireIdVimeo("https://vimeo.com/123456")).toBe("123456");
    expect(extraireIdVimeo("https://player.vimeo.com/video/123456")).toBe("123456");
  });
  it("conserve le hash d'une vidéo non répertoriée", () => {
    expect(extraireIdVimeo("https://vimeo.com/123456/abc123ef")).toBe("123456:abc123ef");
    expect(extraireIdVimeo("123456:abc123ef")).toBe("123456:abc123ef");
  });
  it("rejette le reste", () => expect(extraireIdVimeo("pas une vidéo")).toBeNull());
});

describe("urlIntegration", () => {
  it("YouTube sans cookies ni suggestions", () => {
    expect(urlIntegration("youtube", "dQw4w9WgXcQ"))
      .toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
  });
  it("Vimeo avec et sans hash", () => {
    expect(urlIntegration("vimeo", "123")).toBe("https://player.vimeo.com/video/123");
    expect(urlIntegration("vimeo", "123:ab")).toBe("https://player.vimeo.com/video/123?h=ab");
  });
  it("null pour les autres types", () => expect(urlIntegration("supabase", "x")).toBeNull());
});

describe("cheminVideo", () => {
  it("respecte le format attendu par la policy SQL", () => {
    expect(cheminVideo("f-id", "l-id", "Ma Vidéo.MOV")).toMatch(/^f-id\/l-id\/video-\d+\.mov$/);
    expect(cheminVideo("f", "l", "sans-extension")).toMatch(/\.mp4$/);
  });
});

describe("validerUrlDirecte", () => {
  it("accepte un lien https vers un fichier", () => {
    expect(validerUrlDirecte(" https://videos.exemple.fr/cours/01.mp4 ")).toBe("https://videos.exemple.fr/cours/01.mp4");
    expect(validerUrlDirecte("https://cdn.exemple.fr/v?token=abc")).toBe("https://cdn.exemple.fr/v?token=abc");
  });
  it("refuse http, les liens invalides et HLS", () => {
    expect(validerUrlDirecte("http://exemple.fr/v.mp4")).toBeNull();
    expect(validerUrlDirecte("javascript:alert(1)")).toBeNull();
    expect(validerUrlDirecte("pas une url")).toBeNull();
    expect(validerUrlDirecte("https://exemple.fr/playlist.m3u8")).toBeNull();
  });
});
