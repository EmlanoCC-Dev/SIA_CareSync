import React from 'react';
import {
  CalendarCheck, Clock3, Database, Globe2, Home, MessageCircle,
  Mail, MapPin, Phone, ShieldCheck, Stethoscope, Users,
} from 'lucide-react';
import logoSource from '../assets/landing-logo.png';
import heroImage from '../assets/landing-image-1.png';
import missionImage from '../assets/landing-image-2.png';

function Brand() {
  return (
    <span className="landing-brand" aria-label="CareSync">
      <span className="landing-brand-mark"><img src={logoSource} alt="" /></span>
      <span><b>CARE</b><em>SYNC</em></span>
    </span>
  );
}

export default function LandingPage({ onLogin, onRegister }) {
  return (
    <div className="landing-page" data-node-id="1:7">
      <header className="landing-header">
        <a href="#home" className="landing-logo-link"><Brand /></a>
        <div className="landing-nav-dock">
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#home" aria-label="Home"><Home /><span>Home</span></a>
            <a href="#about" aria-label="About"><Users /><span>About</span></a>
            <a href="#services" aria-label="Services"><Stethoscope /><span>Services</span></a>
            <a href="#/display" aria-label="Waiting room queue"><CalendarCheck /><span>Queue</span></a>
          </nav>
        </div>
        <div className="landing-auth-actions">
          <button type="button" className="landing-button landing-button-light" onClick={onRegister}>Sign Up</button>
          <button type="button" className="landing-button landing-button-dark" onClick={onLogin}>Log In</button>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Appointments &amp; patient flow, made simple</p>
            <h1>Your next visit.<br /><span>A little easier.</span></h1>
            <p className="landing-intro">Find time for your health. Book a clinic appointment, check the waiting-room queue, and keep your consultation records in one place.</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-button landing-button-dark" onClick={onLogin}>Book Appointment <span>→</span></button>
              <a className="landing-button landing-button-light" href="#/display">View waiting-room queue <span>→</span></a>
            </div>
            <ol className="landing-visit-steps" aria-label="Your visit steps"><li><span>1</span>Book a time</li><li><span>2</span>Get confirmation</li><li><span>3</span>Check in &amp; see your doctor</li></ol>
          </div>
          <div className="landing-hero-image"><img src={heroImage} alt="Healthcare professional wearing a stethoscope" /><div className="landing-image-caption"><CalendarCheck size={24} /><div><strong>More clarity at every step</strong><p>From your first booking to your next consultation.</p></div></div></div>
        </section>

        <section className="landing-services" id="services">
          <div className="landing-section-heading">
            <p className="page-eyebrow">Made for your clinic visit</p>
            <h2>Less waiting. More peace of mind.</h2>
            <p>Practical tools to help patients and care teams stay on the same page.</p>
          </div>
          <div className="landing-service-grid" id="queue">
            <article><Clock3 /><h3>Know who is up next</h3><p>See the current queue number and upcoming patients on the waiting-room display. Reception helps you check in when you arrive.</p></article>
            <article><CalendarCheck /><h3>Plan your appointment</h3><p>Choose your doctor and an available time. Check your request status and manage your bookings in your patient portal.</p></article>
            <article><Database /><h3>Keep your care together</h3><p>Return to your consultation notes, prescriptions, and attached medical reports whenever you need them.</p></article>
          </div>
        </section>

        <section className="landing-mission" id="about">
          <div className="landing-mission-image"><img src={missionImage} alt="Clinical staff working in a hospital corridor" /></div>
          <div className="landing-mission-copy">
            <p className="landing-mission-tag">Patients first, at every step</p>
            <h2>Thoughtful care.<br /><span>A clearer experience.</span></h2>
            <p>A clinic visit has enough to think about. Booking your appointment and finding your place in the queue should feel straightforward.</p>
            <p>CareSync connects patients, reception, and doctors around one appointment schedule. Your care team can focus on your visit while you stay informed about what happens next.</p>
            <button type="button" className="landing-button landing-button-dark" onClick={onRegister}>Create your patient account <span>→</span></button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div><Brand /><p>Connecting appointments, patients, and care teams for a smoother clinic experience.</p></div>
          <div><h3>Quick Links</h3><a href="#home">Home</a><a href="#about">About</a><button onClick={onLogin}>Book appointment</button><a href="#/display">Waiting-room queue</a></div>
          <div><h3>Contact Details</h3><p><MapPin /> Sampaloc, Manila</p><p><Mail /> caresync@gmail.com</p><p><Phone /> +63 (0952) 998 3452</p><p><Clock3 /> 10:00am–6:00pm, Mon–Fri</p></div>
          <div><h3>Connect with us!</h3><div className="landing-socials"><Globe2 /><MessageCircle /><ShieldCheck /></div></div>
        </div>
        <div className="landing-copyright">© 2026 CareSync. All rights reserved.</div>
      </footer>
    </div>
  );
}
