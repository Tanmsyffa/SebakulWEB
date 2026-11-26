'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  PiggyBank,
  Plus,
  Users,
  Vote,
} from 'lucide-react';
import { PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, PageTransition, Pressable, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input, RupiahInput } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatActionError } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils/currency';
import {
  castVote,
  closePoll,
  createEvent,
  createPoll,
  getActiveEvents,
} from '@/server/actions/guyub.actions';

interface GuyubClientProps {
  events: Awaited<ReturnType<typeof getActiveEvents>>;
  canManage: boolean;
}

function formatEventDate(dateString: string | null): string {
  if (!dateString) return 'Menunggu kesepakatan tanggal';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function GuyubClient({ events, canManage }: GuyubClientProps) {
  const router = useRouter();
  const [votingPollId, setVotingPollId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [pageError, setPageError] = React.useState('');

  // Create event dialog state
  const [eventOpen, setEventOpen] = React.useState(false);
  const [eventTitle, setEventTitle] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [eventDate, setEventDate] = React.useState('');
  const [budget, setBudget] = React.useState(0);
  const [perWarungFee, setPerWarungFee] = React.useState(0);
  const [eventError, setEventError] = React.useState('');

  // Create poll dialog state
  const [pollEventId, setPollEventId] = React.useState<string | null>(null);
  const [pollKind, setPollKind] = React.useState<'DESTINATION' | 'DATE'>('DESTINATION');
  const [pollQuestion, setPollQuestion] = React.useState('');
  const [pollOptions, setPollOptions] = React.useState('');
  const [pollError, setPollError] = React.useState('');

  // Close poll confirmation dialog state
  const [closingPoll, setClosingPoll] = React.useState<{
    id: string;
    eventTitle: string;
    question: string;
  } | null>(null);
  const [closePollError, setClosePollError] = React.useState('');

  const [saving, setSaving] = React.useState(false);

  const summary = React.useMemo(() => {
    let totalCollectedAll = 0;
    let totalTargetAll = 0;
    let openPollsCount = 0;
    for (const ev of events) {
      totalCollectedAll += ev.totalCollected;
      totalTargetAll += ev.targetBudget;
      if (ev.poll?.status === 'OPEN') openPollsCount += 1;
    }
    return { totalCollectedAll, totalTargetAll, openPollsCount };
  }, [events]);

  function openCreateEvent() {
    setEventError('');
    setEventTitle('');
    setDestination('');
    setEventDate('');
    setBudget(0);
    setPerWarungFee(0);
    setEventOpen(true);
  }

  function openPoll(eventId: string, kind: 'DESTINATION' | 'DATE') {
    setPollError('');
    setPollKind(kind);
    setPollEventId(eventId);
    setPollQuestion(
      kind === 'DESTINATION'
        ? 'Destinasi Guyub yang dipilih?'
        : 'Tanggal pelaksanaan Guyub yang dipilih?'
    );
    setPollOptions('');
  }

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setEventError('');
    setSaving(true);
    try {
      await createEvent({
        title: eventTitle,
        destination,
        eventDate: eventDate || null,
        targetBudget: budget,
        perWarungFee,
      });
      setEventOpen(false);
      setEventTitle('');
      setDestination('');
      setEventDate('');
      setBudget(0);
      setPerWarungFee(0);
      setPageError('');
      setFeedback('Acara Guyub berhasil dibuat.');
      router.refresh();
    } catch (error) {
      setEventError(formatActionError(error, 'Gagal membuat acara baru.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePoll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pollEventId) return;
    setPollError('');

    const options = pollOptions
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setPollError('Masukkan minimal dua pilihan polling (satu pilihan per baris).');
      return;
    }

    setSaving(true);
    try {
      await createPoll({ eventId: pollEventId, question: pollQuestion, options });
      setPollEventId(null);
      setPollQuestion('');
      setPollOptions('');
      setPageError('');
      setFeedback('Polling baru berhasil dibuka.');
      router.refresh();
    } catch (error) {
      setPollError(formatActionError(error, 'Gagal membuat polling.'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmClosePoll = async () => {
    if (!closingPoll) return;
    setClosePollError('');
    setSaving(true);
    try {
      await closePoll(closingPoll.id);
      setClosingPoll(null);
      setPageError('');
      setFeedback('Polling telah ditutup. Hasil suara kini bersifat final.');
      router.refresh();
    } catch (error) {
      setClosePollError(formatActionError(error, 'Gagal menutup polling.'));
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    setPageError('');
    setVotingPollId(pollId);
    try {
      const result = await castVote(pollId, optionId);
      setFeedback(
        result.success
          ? 'Suara warung Anda berhasil tercatat.'
          : 'Warung Anda sudah memilih pada polling ini.'
      );
      router.refresh();
    } catch (err) {
      setPageError(formatActionError(err, 'Gagal memberikan suara.'));
    } finally {
      setVotingPollId(null);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Komunitas sentra"
        title="SEBAKUL Guyub"
        description="Acara kebersamaan komunitas sentra, polling satu suara per warung, serta pantauan tabungan bersama."
        actions={
          canManage ? (
            <Button type="button" onClick={openCreateEvent}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Buat acara</span>
            </Button>
          ) : undefined
        }
      />

      {feedback && (
        <div aria-live="polite">
          <Alert
            variant="success"
            action={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFeedback('')}
              >
                Tutup
              </Button>
            }
          >
            {feedback}
          </Alert>
        </div>
      )}

      {pageError && <Alert variant="danger">{pageError}</Alert>}

      {events.length > 0 && (
        <ResponsiveGrid cols={3}>
          <StatCard
            label="Acara aktif"
            value={<AnimatedNumber value={events.length} />}
            hint="Agenda komunitas berjalan"
            icon={CalendarDays}
            tone="brand"
          />
          <StatCard
            label="Tabungan terkumpul"
            value={<AnimatedNumber value={summary.totalCollectedAll} format={formatRupiah} />}
            hint={`Target gabungan ${formatRupiah(summary.totalTargetAll)}`}
            icon={PiggyBank}
            tone="success"
          />
          <StatCard
            label="Polling terbuka"
            value={<AnimatedNumber value={summary.openPollsCount} />}
            hint="Satu suara mewakili satu warung"
            icon={Vote}
            tone="info"
          />
        </ResponsiveGrid>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada acara aktif"
          description="Pengelola belum membuat rencana acara kebersamaan atau piknik bersama sentra."
          action={
            canManage ? (
              <Button type="button" onClick={openCreateEvent}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                <span>Buat acara pertama</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Section
          title="Daftar acara aktif"
          description="Pilih destinasi atau tanggal pada polling yang terbuka, lalu buka rincian untuk pendaftaran peserta dan split bill."
        >
          <Stagger itemCount={events.length} className="space-y-5">
            {events.map((ev) => {
              const poll = ev.poll;
              const selectedOption = poll?.options.find(
                (opt) => opt.id === poll.selectedOptionId
              );

              return (
                <StaggerItem key={ev.id}>
                  <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 divide-y divide-border-subtle lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                      {/* Left column: Event details & Polling */}
                      <div className="lg:col-span-7">
                        <CardHeader className="border-b border-border-subtle">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <CardTitle>{ev.title}</CardTitle>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
                                  <span>{ev.destination}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
                                  <span>{formatEventDate(ev.eventDate)}</span>
                                </span>
                              </div>
                            </div>
                            <Badge variant="brand">Aktif</Badge>
                          </div>

                          {canManage && (
                            <div className="flex flex-wrap gap-2 pt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openPoll(ev.id, 'DESTINATION')}
                              >
                                <Plus aria-hidden="true" className="h-4 w-4" />
                                <span>Polling destinasi</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => openPoll(ev.id, 'DATE')}
                              >
                                <Plus aria-hidden="true" className="h-4 w-4" />
                                <span>Polling tanggal</span>
                              </Button>
                              {poll && poll.status === 'OPEN' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  disabled={saving}
                                  onClick={() => {
                                    setClosePollError('');
                                    setClosingPoll({
                                      id: poll.id,
                                      eventTitle: ev.title,
                                      question: poll.question,
                                    });
                                  }}
                                >
                                  <Lock aria-hidden="true" className="h-4 w-4" />
                                  <span>Tutup polling</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </CardHeader>

                        <CardContent className="space-y-4 pt-4">
                          {poll ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <p className="text-sm font-bold text-text-primary">
                                    {poll.question}
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    Satu suara per warung ({poll.totalVotes} suara tercatat)
                                  </p>
                                </div>
                                {poll.status === 'OPEN' ? (
                                  <Badge variant="success">
                                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                                    <span>Dibuka</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="neutral">
                                    <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                                    <span>Ditutup</span>
                                  </Badge>
                                )}
                              </div>

                              <div className="space-y-2.5">
                                {poll.options.map((opt) => {
                                  const isSelected = poll.selectedOptionId === opt.id;
                                  const canClick =
                                    poll.canVote &&
                                    !poll.selectedOptionId &&
                                    votingPollId !== poll.id;
                                  const barWidth = opt.percent > 0 ? Math.max(opt.percent, 4) : 0;

                                  return (
                                    <Pressable key={opt.id} disabled={!canClick}>
                                      <button
                                        type="button"
                                        disabled={!canClick}
                                        aria-pressed={isSelected}
                                        aria-label={`Pilih ${opt.optionText} (${opt.percent} persen, ${opt.votes} warung)`}
                                        onClick={() => void handleVote(poll.id, opt.id)}
                                        className={cn(
                                          'w-full min-h-12 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                                          isSelected
                                            ? 'border-brand-primary bg-brand-soft'
                                            : canClick
                                            ? 'border-border-subtle bg-surface hover:border-border-strong hover:bg-surface-muted'
                                            : 'border-border-subtle bg-surface-muted/60 cursor-default'
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                          <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
                                            {isSelected && (
                                              <CheckCircle2
                                                aria-hidden="true"
                                                className="h-4 w-4 shrink-0 text-brand-primary"
                                              />
                                            )}
                                            <span>{opt.optionText}</span>
                                          </span>
                                          <span className="shrink-0 font-mono text-xs font-semibold text-text-secondary tabular-nums">
                                            {opt.percent}% ({opt.votes} warung)
                                          </span>
                                        </div>
                                        <div
                                          aria-hidden="true"
                                          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted border border-border-subtle"
                                        >
                                          <div
                                            className={cn(
                                              'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
                                              isSelected ? 'bg-brand-primary' : 'bg-text-secondary'
                                            )}
                                            style={{ width: `${barWidth}%` }}
                                          />
                                        </div>
                                      </button>
                                    </Pressable>
                                  );
                                })}
                              </div>

                              <p className="text-xs text-text-secondary">
                                {selectedOption
                                  ? `Pilihan warung Anda: ${selectedOption.optionText}.`
                                  : poll.canVote
                                  ? 'Ketuk salah satu pilihan untuk memberikan suara warung Anda.'
                                  : poll.status === 'CLOSED'
                                  ? 'Polling ini sudah ditutup dan tidak menerima suara baru.'
                                  : 'Hanya akun penyewa warung yang dapat memberikan suara.'}
                              </p>
                            </>
                          ) : (
                            <div className="rounded-xl border border-border-subtle bg-surface-muted p-4 text-sm text-text-secondary">
                              Belum ada polling yang dibuka untuk acara ini.
                            </div>
                          )}
                        </CardContent>
                      </div>

                      {/* Right column: Tabungan & Split bill link */}
                      <div className="flex flex-col justify-between bg-surface-muted/40 lg:col-span-5">
                        <CardHeader>
                          <CardDescription className="text-xs font-medium text-text-secondary">
                            Tabungan bersama
                          </CardDescription>
                          <div className="flex items-baseline justify-between gap-2 pt-1">
                            <p className="font-mono text-2xl font-semibold text-text-primary tabular-nums">
                              <AnimatedNumber value={ev.totalCollected} format={formatRupiah} />
                            </p>
                            <span className="font-mono text-sm font-semibold text-brand-primary tabular-nums">
                              {ev.progressPercent}%
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary">
                            dari target {formatRupiah(ev.targetBudget)}
                          </p>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <Progress
                            value={ev.progressPercent}
                            label={`Progres tabungan ${ev.title}`}
                            tone={ev.progressPercent >= 100 ? 'success' : 'brand'}
                          />

                          <div className="rounded-xl border border-border-subtle bg-surface p-3.5 text-xs text-text-secondary space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span>Ketentuan iuran</span>
                              <span className="font-mono font-semibold text-text-primary tabular-nums">
                                {ev.perWarungFee !== null
                                  ? `${formatRupiah(ev.perWarungFee)} / warung`
                                  : 'Mengikuti jumlah peserta'}
                              </span>
                            </div>
                            <p>
                              Pendaftaran jumlah peserta, pembayaran iuran, catatan talangan, dan
                              perhitungan split bill tersedia di halaman detail.
                            </p>
                          </div>

                          <Link
                            href={`/guyub/${ev.id}`}
                            className={cn(
                              buttonVariants({ variant: 'default' }),
                              'w-full justify-between'
                            )}
                          >
                            <span>Lihat detail dan split bill</span>
                            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                          </Link>
                        </CardContent>
                      </div>
                    </div>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Section>
      )}

      {/* Dialog: Buat Acara Guyub */}
      {canManage && (
        <Dialog
          open={eventOpen}
          onOpenChange={(open) => {
            if (!saving) {
              if (!open) setEventError('');
              setEventOpen(open);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat acara Guyub</DialogTitle>
              <DialogDescription>
                Satu warung mewakili satu keluarga. Jumlah orang dipakai untuk perencanaan acara.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              {eventError && <Alert variant="danger">{eventError}</Alert>}
              <Field label="Judul acara" htmlFor="guyub-event-title" required>
                <Input
                  id="guyub-event-title"
                  required
                  minLength={2}
                  maxLength={120}
                  value={eventTitle}
                  onChange={(event) => setEventTitle(event.target.value)}
                  placeholder="Contoh: Healing akhir tahun sentra"
                />
              </Field>
              <Field label="Tujuan acara" htmlFor="guyub-event-destination" required>
                <Input
                  id="guyub-event-destination"
                  required
                  minLength={2}
                  maxLength={120}
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Contoh: Pantai Parangtritis atau menunggu polling"
                />
              </Field>
              <Field label="Tanggal acara (opsional)" htmlFor="guyub-event-date">
                <Input
                  id="guyub-event-date"
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Target dana acara" htmlFor="guyub-event-budget" required>
                  <RupiahInput
                    id="guyub-event-budget"
                    required
                    value={budget}
                    onValueChange={(value) => setBudget(Math.min(999_999_999, value))}
                  />
                </Field>
                <Field label="Iuran per warung" htmlFor="guyub-event-fee" required>
                  <RupiahInput
                    id="guyub-event-fee"
                    required
                    value={perWarungFee}
                    onValueChange={(value) => setPerWarungFee(Math.min(999_999_999, value))}
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setEventOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} isLoading={saving}>
                  Simpan acara
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog: Buat Polling */}
      {canManage && (
        <Dialog
          open={!!pollEventId}
          onOpenChange={(open) => {
            if (!open && !saving) {
              setPollError('');
              setPollEventId(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Polling {pollKind === 'DESTINATION' ? 'destinasi' : 'tanggal'}
              </DialogTitle>
              <DialogDescription>
                Setiap warung mendapat satu suara untuk memilih opsi terbaik.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              {pollError && <Alert variant="danger">{pollError}</Alert>}
              <Field label="Pertanyaan polling" htmlFor="guyub-poll-question" required>
                <Input
                  id="guyub-poll-question"
                  required
                  minLength={3}
                  maxLength={300}
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                />
              </Field>
              <Field
                label={
                  pollKind === 'DESTINATION'
                    ? 'Pilihan destinasi (satu per baris)'
                    : 'Pilihan tanggal (YYYY-MM-DD, satu per baris)'
                }
                htmlFor="guyub-poll-options"
                hint="Masukkan minimal 2 pilihan dan maksimal 10 pilihan."
                required
              >
                <Textarea
                  id="guyub-poll-options"
                  required
                  rows={4}
                  value={pollOptions}
                  onChange={(event) => setPollOptions(event.target.value)}
                  placeholder={
                    pollKind === 'DESTINATION'
                      ? 'Pantai Parangtritis\nKebun Teh Nglinggo'
                      : '2026-12-10\n2026-12-17'
                  }
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setPollEventId(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} isLoading={saving}>
                  Buka polling
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog: Konfirmasi Tutup Polling */}
      {canManage && (
        <Dialog
          open={!!closingPoll}
          onOpenChange={(open) => {
            if (!open && !saving) {
              setClosePollError('');
              setClosingPoll(null);
            }
          }}
        >
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Tutup polling sekarang?</DialogTitle>
              <DialogDescription>
                Setelah ditutup, warung tidak dapat lagi memberikan suara dan hasil saat ini akan
                menjadi hasil akhir.
              </DialogDescription>
            </DialogHeader>
            {closePollError && <Alert variant="danger">{closePollError}</Alert>}
            {closingPoll && (
              <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
                <p className="font-semibold text-text-primary">{closingPoll.eventTitle}</p>
                <p className="text-xs text-text-secondary">{closingPoll.question}</p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setClosingPoll(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                isLoading={saving}
                onClick={() => void handleConfirmClosePoll()}
              >
                Tutup polling
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageTransition>
  );
}
