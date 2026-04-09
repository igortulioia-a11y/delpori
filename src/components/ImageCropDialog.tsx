"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedBlob } from "@/lib/image-crop";
import { toast } from "@/hooks/use-toast";

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  aspect?: number;
  title?: string;
  maxSize?: number;
  quality?: number;
  onCropComplete: (blob: Blob) => void | Promise<void>;
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  aspect = 1,
  title = "Ajustar imagem",
  maxSize = 800,
  quality = 0.85,
  onCropComplete,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  // Reset do estado quando o dialog abre com nova imagem
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, maxSize, quality);
      await onCropComplete(blob);
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao processar imagem:", err);
      toast({
        title: "Erro ao processar imagem",
        description: err instanceof Error ? err.message : "Tente outra imagem",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (processing) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (processing ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cropper */}
          <div className="relative h-72 sm:h-80 bg-muted rounded-lg overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                showGrid={false}
                objectFit="contain"
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 px-1">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(v) => setZoom(v[0])}
              disabled={processing}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Arraste para posicionar e use o zoom para ajustar
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={processing || !croppedAreaPixels}>
            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {processing ? "Processando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
