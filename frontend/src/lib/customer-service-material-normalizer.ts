import type { MaterialAssetKind } from "@/lib/material-assets";
import {
  assertMediaUploadFile,
  MEDIA_OPTIMIZATION_CONTRACT,
  normalizeMediaUploadFileType,
  resolveMediaUploadKind,
} from "@/lib/media-optimization-contract";

const avatarRule = MEDIA_OPTIMIZATION_CONTRACT.avatar;

export function resolveCustomerServiceUploadKind(file: File): MaterialAssetKind | null {
  return resolveMediaUploadKind(file);
}

export function normalizeCustomerServiceUploadFileType(file: File): File {
  return normalizeMediaUploadFileType(file);
}

async function normalizeAvatarImageMaterial(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("头像图片无法读取"));
      nextImage.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = avatarRule.width;
    canvas.height = avatarRule.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("头像图片处理不可用");
    const scale = Math.max(avatarRule.width / image.naturalWidth, avatarRule.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (avatarRule.width - width) / 2, (avatarRule.height - height) / 2, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("头像图片处理失败")),
      avatarRule.imageOutputMimeType,
      avatarRule.imageQuality,
    ));
    if (blob.type !== avatarRule.imageOutputMimeType) throw new Error("当前浏览器不支持 WebP 头像压缩");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
    const result = new File([blob], `${baseName}-${avatarRule.width}.webp`, { type: blob.type, lastModified: file.lastModified });
    await assertMediaUploadFile(result, "image");
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeAvatarVideoMaterial(file: File): Promise<File> {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    throw new Error(`当前浏览器不支持将视频头像转换为 ${avatarRule.width} × ${avatarRule.height}`);
  }
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  let stream: MediaStream | undefined;
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = MEDIA_OPTIMIZATION_CONTRACT.delivery.videoPreload;
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("头像视频无法读取"));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("视频时长无法读取，请使用包含完整时长信息的 MP4 或 WebM");
    }
    if (video.duration > avatarRule.maxDurationSeconds) throw new Error(`视频头像不能超过 ${avatarRule.maxDurationSeconds} 秒`);
    if (!MEDIA_OPTIMIZATION_CONTRACT.optimization.video.browserTranscode) {
      await assertMediaUploadFile(file, "video");
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = avatarRule.width;
    canvas.height = avatarRule.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("头像视频处理不可用");
    const scale = Math.max(avatarRule.width / video.videoWidth, avatarRule.height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const drawFrame = () => context.drawImage(video, (avatarRule.width - drawWidth) / 2, (avatarRule.height - drawHeight) / 2, drawWidth, drawHeight);
    drawFrame();
    stream = canvas.captureStream(avatarRule.videoFrameRate);
    const recorderMimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!recorderMimeType) throw new Error("当前浏览器不支持 WebM 视频头像压缩");
    const recorder = new MediaRecorder(stream, {
      mimeType: recorderMimeType,
      videoBitsPerSecond: avatarRule.videoBitsPerSecond,
    });
    const chunks: BlobPart[] = [];
    const completed = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("头像视频转换失败"));
      recorder.onstop = () => resolve(new Blob(chunks, { type: avatarRule.videoOutputMimeType }));
    });
    let frameRequest = 0;
    const render = () => {
      if (!video.ended) {
        drawFrame();
        frameRequest = requestAnimationFrame(render);
      }
    };
    recorder.start(250);
    video.currentTime = 0;
    await video.play();
    frameRequest = requestAnimationFrame(render);
    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("头像视频转换中断"));
    });
    cancelAnimationFrame(frameRequest);
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await completed;
    if (!blob.size) throw new Error("头像视频转换结果为空");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
    const result = new File([blob], `${baseName}-${avatarRule.width}.webm`, { type: avatarRule.videoOutputMimeType, lastModified: file.lastModified });
    await assertMediaUploadFile(result, "video");
    return result;
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function normalizeAvatarMaterial(file: File): Promise<File> {
  const normalizedFile = normalizeCustomerServiceUploadFileType(file);
  const kind = resolveCustomerServiceUploadKind(normalizedFile);
  if (kind !== "image" && kind !== "video") return normalizedFile;
  await assertMediaUploadFile(normalizedFile, kind);
  return kind === "image"
    ? normalizeAvatarImageMaterial(normalizedFile)
    : normalizeAvatarVideoMaterial(normalizedFile);
}
