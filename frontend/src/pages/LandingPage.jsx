import React from 'react';
import {
  CalendarCheck, Clock3, Database, Globe2, Home, MessageCircle,
  Mail, MapPin, Phone, ShieldCheck, Stethoscope, UserRound, Users,
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
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#home" aria-label="Home"><Home /></a>
          <a href="#about" aria-label="About"><Users /></a>
          <a href="#services" aria-label="Services"><Stethoscope /></a>
          <a href="#queue" aria-label="Queue"><CalendarCheck /></a>
          <button type="button" onClick={onLogin} aria-label="Profile"><UserRound /></button>
        </nav>
        <div className="landing-auth-actions">
          <button type="button" className="landing-button landing-button-light" onClick={onRegister}>Sign Up</button>
          <button type="button" className="landing-button landing-button-dark" onClick={onLogin}>Log In</button>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Welcome to CareSync</p>
            <h1><span>Expert Care.</span><br />Every Time.</h1>
            <p className="landing-intro">Experience a smarter way to manage your hospital visit with digital queuing. Track your queue status and receive timely notifications from anywhere.</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-button landing-button-dark" onClick={onLogin}>Book Appointment <span>→</span></button>
              <a className="landing-button landing-button-light" href="#services">Our Services <span>→</span></a>
            </div>
          </div>
          <div className="landing-hero-image"><img src={heroImage} alt="Healthcare professional wearing a stethoscope" /></div>
        </section>

        <section className="landing-services" id="services">
          <div className="landing-section-heading">
            <h2>Systematic Efficiency</h2>
            <p>Designed with Clinical Minimalism to reduce cognitive load and enhance operational clarity across all touchpoints.</p>
          </div>
          <div className="landing-service-grid" id="queue">
            <article><Clock3 /><h3>Real-time Queuing</h3><p>Intelligent patient flow management that provides accurate wait times and reduces congestion in waiting areas, fostering a calmer environment.</p></article>
            <article><CalendarCheck /><h3>Seamless Appointments</h3><p>Frictionless scheduling for patients and administrators, ensuring optimized practitioner utilization and zero double-bookings.</p></article>
            <article><Database /><h3>Integrated Records</h3><p>Unified clinical data presentation that strips away visual noise, presenting practitioners with actionable patient history at a glance.</p></article>
          </div>
        </section>

        <section className="landing-mission" id="about">
          <div className="landing-mission-image"><img src={missionImage} alt="Clinical staff working in a hospital corridor" /></div>
          <div className="landing-mission-copy">
            <h2>Our <span>Mission</span></h2>
            <p className="landing-mission-tag">Clarity in Care</p>
            <p>CareSync was born from a singular observation: healthcare environments are inherently high-stress, yet the tools used to manage them often add cognitive friction rather than alleviating it.</p>
            <p>We believe in <strong>Clinical Minimalism</strong>. By removing non-essential visual noise and prioritizing data clarity, we create systems that feel authoritative, reliable, and inherently calm.</p>
            <p>Our platforms are designed not just to process data, but to facilitate emotional regulation for patients seeking clarity and operational flow for practitioners requiring precision.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div><Brand /><p>CareSync Hospital is dedicated to delivering world-class, patient-centered healthcare through advanced medical technology, compassionate clinical expertise, and a commitment to community wellness.</p></div>
          <div><h3>Quick Links</h3><a href="#home">Home</a><a href="#about">About</a><button onClick={onLogin}>Appointment</button><a href="#queue">Queue</a></div>
          <div><h3>Contact Details</h3><p><MapPin /> Sampaloc, Manila</p><p><Mail /> caresync@gmail.com</p><p><Phone /> +63 (0952) 998 3452</p><p><Clock3 /> 10:00am–6:00pm, Mon–Fri</p></div>
          <div><h3>Connect with us!</h3><div className="landing-socials"><Globe2 /><MessageCircle /><ShieldCheck /></div></div>
        </div>
        <div className="landing-copyright">© 2026 CareSync. All rights reserved.</div>
      </footer>
    </div>
  );
}
