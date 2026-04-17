"use client";

import { useState } from "react";
import { Play, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Tutorial {
  id: string;
  titulo: string;
  descricao: string;
  youtubeId: string;
  duracao: string;
}

// Array central de tutoriais. Pra trocar por um vídeo real: pegue o ID do
// YouTube (parte depois de "v=" ou depois da "/" em youtu.be/) e substitua
// em `youtubeId`. Atualize também `duracao` com o tempo real do vídeo.
// Ex: URL https://youtu.be/dQw4w9WgXcQ → youtubeId: "dQw4w9WgXcQ"
const TUTORIAIS: Tutorial[] = [
  {
    id: "1",
    titulo: "Visão geral",
    descricao: "Tour rápido pelo Delpori mostrando o que cada área faz.",
    youtubeId: "radIl4e4Ku4",
    duracao: "2:01",
  },
  {
    id: "2",
    titulo: "IA na prática",
    descricao: "Como a IA atende seus clientes no WhatsApp de ponta a ponta.",
    youtubeId: "vmZ8UCVFNmY",
    duracao: "9:59",
  },
  {
    id: "3",
    titulo: "Dashboard",
    descricao: "KPIs, gráficos e filtros de período para acompanhar seu delivery.",
    youtubeId: "IAdUt-PFUA8",
    duracao: "0:32",
  },
  {
    id: "4",
    titulo: "Conversas",
    descricao: "Acompanhando atendimentos da IA e assumindo conversas quando precisar.",
    youtubeId: "FlSbhGrynns",
    duracao: "3:41",
  },
  {
    id: "5",
    titulo: "Pedidos",
    descricao: "Kanban de status, tabela com filtros e cupom térmico pra cozinha.",
    youtubeId: "rzCrkL0Ilds",
    duracao: "3:23",
  },
  {
    id: "6",
    titulo: "Cardápio",
    descricao: "Adicionar produtos, categorias, fotos e opções (adicionais, tamanhos).",
    youtubeId: "guDK52tlQlw",
    duracao: "2:06",
  },
  {
    id: "7",
    titulo: "Automações",
    descricao: "Horário de funcionamento, follow-up, promoção do dia e campanhas.",
    youtubeId: "3Lnf9XHAbk0",
    duracao: "5:25",
  },
  {
    id: "8",
    titulo: "Configurações",
    descricao: "Dados do restaurante, WhatsApp (QR code) e equipe.",
    youtubeId: "2krnr93vib4",
    duracao: "1:37",
  },
];

export default function Tutoriais() {
  const [playing, setPlaying] = useState<Tutorial | null>(null);

  const thumbUrl = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  // vq=hd1080 sugere ao YouTube comecar em HD se disponivel.
  const embedUrl = (id: string) =>
    `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&autoplay=1&vq=hd1080`;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tutoriais</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vídeos curtos explicando como usar cada parte do Delpori
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TUTORIAIS.map(t => (
          <Card
            key={t.id}
            className="shadow-sm overflow-hidden transition-shadow hover:shadow-md group cursor-pointer"
            onClick={() => setPlaying(t)}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-secondary overflow-hidden">
              <img
                src={thumbUrl(t.youtubeId)}
                alt={t.titulo}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-primary ml-0.5" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {t.duracao}
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm leading-tight mb-1">{t.titulo}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{t.descricao}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Player modal */}
      <Dialog open={!!playing} onOpenChange={(open) => !open && setPlaying(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          {playing && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3">
                <DialogTitle className="pr-8">{playing.titulo}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">{playing.duracao}</p>
              </DialogHeader>
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embedUrl(playing.youtubeId)}
                  title={playing.titulo}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              {playing.descricao && (
                <div className="px-6 py-4 text-sm text-muted-foreground border-t">
                  {playing.descricao}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
