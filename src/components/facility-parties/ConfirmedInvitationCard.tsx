"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import type { PartyInvitationCardProps } from './PartyInvitationCard';
import { FACILITY_INVITATION_VENUE } from '@/lib/facility-parties/invitations/snapshot';
import { InvitationQr } from './InvitationQr';
const styles: Record<string,string> = {"frame":"confirmed-invitation-frame","card":"confirmed-invitation-card","spotlight":"confirmed-invitation-spotlight","portrait":"confirmed-invitation-portrait","banner":"confirmed-invitation-banner","sheet":"confirmed-invitation-sheet","heading":"confirmed-invitation-heading","logo":"confirmed-invitation-logo","eyebrow":"confirmed-invitation-eyebrow","age":"confirmed-invitation-age","artwork":"confirmed-invitation-artwork","footer":"confirmed-invitation-footer","details":"confirmed-invitation-details","venue":"confirmed-invitation-venue","qr":"confirmed-invitation-qr","qrImage":"confirmed-invitation-qrImage"};

export function ConfirmedInvitationCard({ snapshot, childName, childAge, customerPhone, dateLabel, timeLabel, qrUrl, waiverUrl, sheetMode }: PartyInvitationCardProps) {
  const [failed, setFailed] = useState(false);
  const theme = snapshot.confirmedTheme!;
  const variant = snapshot.optionIndex % 3;
  return <article className={styles.frame} data-confirmed-theme-id={theme.id} data-confirmed-layout={['spotlight','portrait','banner'][variant]} data-sheet-mode={sheetMode ? 'true' : undefined}>
    <div className={[styles.card, styles[['spotlight','portrait','banner'][variant]], sheetMode ? styles.sheet : ''].join(' ')}>
      <header className={styles.heading}>
        <img src="/logo.png" alt="Jumping Jax" className={styles.logo} />
        <p className={styles.eyebrow}>You’re invited</p>
        <h2>{childName.trim() || 'Birthday Star'}</h2>
        <p className={styles.age}>{childAge.trim() ? 'is turning ' + childAge.trim() + '!' : 'Birthday celebration'}</p>
      </header>
      <div className={styles.artwork}>
        {failed ? <p role="alert">Your confirmed picture could not load. Please reload to try again. Your selection is saved.</p> : <img key={theme.imagePath} src={theme.imagePath} alt={theme.label} onError={() => setFailed(true)} />}
      </div>
      <footer className={styles.footer}>
        <div className={styles.details}>
          <p><strong>{dateLabel || 'Date coming soon'}</strong></p>
          <p>{timeLabel || 'Time coming soon'}</p>
          <p className={styles.venue}><strong>{FACILITY_INVITATION_VENUE.name}</strong><br />{FACILITY_INVITATION_VENUE.address}</p>
          {customerPhone ? <p>Party contact: {customerPhone}</p> : null}
        </div>
        {qrUrl ? <div className={styles.qr}><InvitationQr src={qrUrl} href={waiverUrl} className={styles.qrImage} /><p>RSVP &amp; guest list</p></div> : null}
      </footer>
    </div>
  </article>;
}
