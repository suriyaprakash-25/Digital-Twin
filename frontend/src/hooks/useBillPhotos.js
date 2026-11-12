import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DIMENSION = 1200;

/** Downscales a data URL to at most 1200px and re-encodes it as JPEG. */
export const compressImage = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION; }
      else { width = Math.round(width * MAX_DIMENSION / height); height = MAX_DIMENSION; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.72));
  };
  img.src = dataUrl;
});

/**
 * Bill / service photos captured from a file picker or the device camera.
 * Photos are kept as compressed data URLs and submitted with the service record.
 */
export function useBillPhotos() {
  const [billPhotos, setBillPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const addPhoto = (dataUrl) => setBillPhotos((prev) => [...prev, dataUrl]);

  const handleBillPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      addPhoto(await compressImage(reader.result));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeBillPhoto = (idx) => {
    setBillPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Never leave the camera running after the page unmounts.
  useEffect(() => stopStream, [stopStream]);

  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraError('');
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Could not access camera. Please allow camera permission or use "Choose File".');
    }
  }, [facingMode, stopStream]);

  const openCamera = async () => {
    setShowCamera(true);
    await startCamera();
  };

  const closeCamera = () => {
    stopStream();
    setShowCamera(false);
    setCameraError('');
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const raw = canvas.toDataURL('image/jpeg', 0.85);
    addPhoto(await compressImage(raw));
    closeCamera();
  };

  return {
    billPhotos,
    handleBillPhotoChange,
    removeBillPhoto,
    camera: { showCamera, cameraError, videoRef, canvasRef, openCamera, closeCamera, flipCamera, capturePhoto },
  };
}

export default useBillPhotos;
