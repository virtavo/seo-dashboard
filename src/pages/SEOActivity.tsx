import React, { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { gscApi, getValidToken } from '@/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, FileText, Lightbulb, AlignLeft, Search, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const COLORS = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ec4899','#8b5cf6','#ef4444','#14b8a6']

function deriveKwSite(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return `https://www.${scMatch[1]}/`
  return siteUrl.endsWith('/') ? siteUrl : siteUrl + '/'
}
function deriveOptSite(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1]
  try { return new URL(siteUrl).hostname.replace(/^www\./, '') } catch { return siteUrl }
}
function badgeLabel(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1]
  try { return new URL(siteUrl).hostname } catch { return siteUrl }
}

// ── Articles registry: keyed by site domain ──────────────────────
// Add new sites/articles here without touching component logic
const ARTICLES_REGISTRY: Record<string, Array<{
  id: number; title: string; slug: string; keyword: string;
  secondary: string[]; product: string; file: string; status: string; date: string;
}>> = {
  // ── showmo365.com ──────────────────────────────────────────────
  'showmo365.com': [
    { id: 1, title: 'Best Long-Range Security Camera with No Monthly Fees (2026 Guide)', slug: '/blog/long-range-security-camera-no-monthly-fee/', keyword: 'long range security camera no monthly fee', secondary: ['wifi halow security camera','1 mile range security camera','remote security camera no cell service'], product: 'MileFlask', file: 'showmo_article1_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 2, title: 'Window Mounted Security Camera: The Complete Guide (2026)',           slug: '/blog/window-mounted-security-camera-guide/',          keyword: 'window mounted security camera',              secondary: ['glass mounted camera','indoor security camera outdoor view','security camera through window'],                product: 'WinEye',    file: 'showmo_article2_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 3, title: 'Why Glass-Mounted Security Cameras Are Booming in 2026',             slug: '/blog/why-glass-mounted-security-cameras-are-growing/', keyword: 'glass mounted camera',                        secondary: ['window mounted security camera','no drill security camera','rental apartment security camera'],            product: 'WinEye',    file: 'showmo_article3_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 4, title: 'Best Security Camera for Renters: No Drilling, No Permission Needed (2026)', slug: '/blog/best-security-camera-for-renters/', keyword: 'security camera for renters',               secondary: ['apartment security camera no drilling','no drill security camera','window security camera apartment'], product: 'WinEye',    file: 'showmo_article4_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 5, title: 'Wi-Fi HaLow Security Camera: The Complete 2026 Guide (802.11ah)',    slug: '/blog/wifi-halow-security-camera-guide/',               keyword: 'wifi halow security camera',                secondary: ['802.11ah security camera','long range wifi security camera','halow camera system'],                      product: 'MileFlask', file: 'showmo_article5_wordpress.html', status: 'ready', date: '2026-05-27' },
  ],
  // ── virtavo.com ────────────────────────────────────────────────
  'virtavo.com': [
    // Articles will be added here as they are written
  ],
  // ── mysnapvitals.com ────────────────────────────────────────
  'mysnapvitals.com': [
    { id: 1, title: '10 Daily Habits That Naturally Lower Blood Pressure for Seniors', slug: '/blog/lower-blood-pressure-naturally-seniors/', keyword: 'lower blood pressure for seniors', secondary: ["natural blood pressure remedies", "high blood pressure lifestyle changes", "daily habits to lower blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-06' },
    { id: 2, title: 'Understanding Your Blood Pressure Numbers: A Complete Senior\', slug: '/blog/understanding-blood-pressure-numbers/', keyword: 'blood pressure numbers for seniors', secondary: ["understanding blood pressure readings", "systolic vs diastolic explained", "high blood pressure for elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-09' },
    { id: 3, title: 'The Best Foods to Lower Blood Pressure After 60', slug: '/blog/best-foods-lower-blood-pressure-over-60/', keyword: 'foods to lower blood pressure', secondary: ["lower blood pressure diet", "blood pressure diet for seniors", "best foods for high blood pressure over 60"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-12' },
    { id: 4, title: 'Walking Your Way to Better Blood Pressure: A Senior\', slug: '/blog/exercise-guide-seniors-blood-pressure/', keyword: 'walking for blood pressure', secondary: ["exercise for seniors blood pressure", "lower blood pressure exercise", "senior walking program blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-15' },
    { id: 5, title: 'How Stress Raises Blood Pressure — and 7 Science-Backed Ways to Fight Back', slug: '/blog/stress-blood-pressure-seniors/', keyword: 'stress and blood pressure', secondary: ["lower blood pressure naturally", "hypertension in seniors", "managing stress for older adults"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-18' },
    { id: 6, title: 'Why Poor Sleep Raises Blood Pressure — and How to Fix It', slug: '/blog/sleep-blood-pressure-connection/', keyword: 'sleep and blood pressure', secondary: ["high blood pressure seniors", "sleep apnea blood pressure", "nocturnal dipping"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-21' },
    { id: 7, title: 'How to Monitor Blood Pressure at Home Like a Pro', slug: '/blog/home-blood-pressure-monitoring-guide/', keyword: 'monitor blood pressure at home', secondary: ["home blood pressure monitoring", "blood pressure tracking app", "how to check blood pressure at home"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-24' },
    { id: 8, title: 'The DASH Diet: Your Complete Guide to Eating for Lower Blood Pressure', slug: '/blog/dash-diet-complete-guide/', keyword: 'DASH diet for seniors', secondary: ["lower blood pressure diet", "dietary approaches to stop hypertension", "eating plan for high blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-27' },
    { id: 9, title: 'Blood Pressure Medications: What Every Senior Should Know', slug: '/blog/blood-pressure-medications-seniors-guide/', keyword: 'blood pressure medications for seniors', secondary: ["blood pressure medicine side effects", "hypertension drugs elderly", "best blood pressure medicine for older adults"], product: 'SnapVitals', file: '', status: 'published', date: '2026-01-30' },
    { id: 10, title: '15 Practical Ways to Reduce Salt — Without Sacrificing Flavor', slug: '/blog/reducing-salt-sodium-seniors/', keyword: 'reduce salt for high blood pressure', secondary: ["low sodium diet for seniors", "how to lower blood pressure naturally", "foods to avoid for high blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-02' },
    { id: 11, title: 'Blood Pressure and Your Heart: Understanding the Connection', slug: '/blog/blood-pressure-heart-connection/', keyword: 'high blood pressure and heart disease', secondary: ["hypertension effects on heart", "blood pressure damage to arteries", "how high blood pressure affects seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-05' },
    { id: 12, title: 'Why Your Blood Pressure Changes With the Seasons', slug: '/blog/seasonal-blood-pressure-changes/', keyword: 'blood pressure changes with seasons', secondary: ["seasonal blood pressure variation", "blood pressure high in winter", "blood pressure low in summer seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-08' },
    { id: 13, title: 'How to Have Better Conversations With Your Doctor About Blood Pressure', slug: '/blog/talking-to-doctor-blood-pressure/', keyword: 'talking to doctor about blood pressure', secondary: ["blood pressure doctor visit tips for seniors", "how to discuss hypertension with doctor", "what to tell doctor about blood pressure readings"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-11' },
    { id: 14, title: 'Genetics and Blood Pressure: What Family History Means for Seniors', slug: '/blog/family-history-blood-pressure/', keyword: 'genetics and blood pressure seniors', secondary: ["family history high blood pressure", "hereditary hypertension causes", "blood pressure risk factors for elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-14' },
    { id: 15, title: 'How Technology Is Transforming Blood Pressure Management for Seniors', slug: '/blog/snapvitals-blood-pressure-tracking-app/', keyword: 'blood pressure management for seniors', secondary: ["senior health technology", "blood pressure tracking app for elderly", "how to manage blood pressure at home"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-17' },
    { id: 16, title: 'The Dangerous Duo: Managing High Blood Pressure and Diabetes Together', slug: '/blog/hypertension-diabetes-connection/', keyword: 'manage high blood pressure and diabetes', secondary: ["hypertension and diabetes management", "blood pressure diabetes control", "managing diabetes and high blood pressure for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-20' },
    { id: 17, title: 'Blood Pressure and Kidney Health: Understanding the Two-Way Street', slug: '/blog/blood-pressure-kidney-health/', keyword: 'blood pressure kidney health', secondary: ["kidney disease blood pressure", "hypertension kidney damage", "how kidneys control blood pressure for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-23' },
    { id: 18, title: 'Alcohol and Blood Pressure: What Every Senior Should Know', slug: '/blog/alcohol-blood-pressure-seniors/', keyword: 'alcohol and blood pressure for seniors', secondary: ["alcohol effects on elderly blood pressure", "can alcohol raise blood pressure", "safe alcohol consumption for older adults"], product: 'SnapVitals', file: '', status: 'published', date: '2026-02-26' },
    { id: 19, title: 'Does Coffee Raise Blood Pressure? A Balanced Look at Caffeine', slug: '/blog/coffee-caffeine-blood-pressure/', keyword: 'coffee blood pressure seniors', secondary: ["caffeine effects blood pressure", "does coffee raise blood pressure", "blood pressure caffeine elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-01' },
    { id: 20, title: 'Potassium and Magnesium: The Two Minerals Your Blood Pressure Desperately Needs', slug: '/blog/potassium-magnesium-blood-pressure/', keyword: 'potassium and blood pressure', secondary: ["magnesium and blood pressure", "minerals for blood pressure", "foods high in potassium for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-04' },
    { id: 21, title: 'Lose 10 Pounds, Drop Your Blood Pressure: The Weight-BP Connection', slug: '/blog/weight-loss-blood-pressure/', keyword: 'weight loss blood pressure', secondary: ["lose weight lower blood pressure", "blood pressure and weight loss for seniors", "how much weight loss to lower blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-07' },
    { id: 22, title: 'Yoga and Tai Chi for Blood Pressure: The Science Behind Ancient Practices', slug: '/blog/yoga-tai-chi-blood-pressure/', keyword: 'yoga for blood pressure', secondary: ["tai chi for blood pressure", "lower blood pressure naturally", "blood pressure exercises for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-10' },
    { id: 23, title: 'How Mindfulness Literally Changes Your Heart: The Neuroscience Explained', slug: '/blog/mindfulness-heart-health/', keyword: 'mindfulness and blood pressure', secondary: ["lower blood pressure naturally", "mindfulness for seniors", "stress reduction for high blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-13' },
    { id: 24, title: 'Low Blood Pressure in Seniors: When "Lower Is Better" Isn\', slug: '/blog/low-blood-pressure-seniors/', keyword: 'low blood pressure in seniors', secondary: ["hypotension elderly symptoms", "managing low blood pressure older adults", "what causes low blood pressure in older people"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-16' },
    { id: 25, title: 'Stroke Prevention Starts With Blood Pressure: What You Need to Know', slug: '/blog/stroke-prevention-blood-pressure/', keyword: 'stroke prevention for seniors', secondary: ["high blood pressure stroke risk", "manage blood pressure seniors", "blood pressure and stroke connection"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-19' },
    { id: 26, title: 'Wrist vs. Arm Blood Pressure Monitors: Which One Should You Use?', slug: '/blog/wrist-vs-arm-blood-pressure-monitors/', keyword: 'blood pressure monitor', secondary: ["arm blood pressure monitor", "wrist blood pressure monitor", "best blood pressure monitor for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-22' },
    { id: 27, title: 'The Morning Blood Pressure Surge: Why Your Worst Readings Happen at Dawn', slug: '/blog/morning-blood-pressure-surge/', keyword: 'morning blood pressure surge', secondary: ["high blood pressure in morning", "blood pressure circadian rhythm", "why is my blood pressure high in the morning"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-25' },
    { id: 28, title: 'Omega-3 Fatty Acids and Blood Pressure: A Comprehensive Guide', slug: '/blog/omega3-fatty-acids-heart-health/', keyword: 'omega 3 for blood pressure', secondary: ["omega 3 sources", "reduce blood pressure", "omega 3 for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-28' },
    { id: 29, title: 'Dehydration and Blood Pressure: The Hidden Connection Seniors Miss', slug: '/blog/dehydration-blood-pressure/', keyword: 'dehydration blood pressure seniors', secondary: ["hydration elderly blood pressure", "older adults dehydration risks", "how dehydration affects blood pressure in seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-03-31' },
    { id: 30, title: 'How Gardening Lowers Blood Pressure: Nature\', slug: '/blog/gardening-seniors-blood-pressure/', keyword: 'gardening lowers blood pressure', secondary: ["garden therapy for seniors", "lower blood pressure naturally", "benefits of gardening for elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-03' },
    { id: 31, title: 'The Family Caregiver\', slug: '/blog/caregiver-guide-elderly-blood-pressure/', keyword: 'manage blood pressure elderly', secondary: ["caregiver blood pressure guide", "home blood pressure monitoring seniors", "how to help elderly with high blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-06' },
    { id: 32, title: 'Can Intermittent Fasting Lower Blood Pressure? What the Research Shows', slug: '/blog/intermittent-fasting-blood-pressure/', keyword: 'intermittent fasting blood pressure', secondary: ["fasting for seniors", "lower blood pressure naturally", "time restricted eating blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-09' },
    { id: 33, title: 'High Blood Pressure and Your Eyes: What Hypertension Does to Vision', slug: '/blog/blood-pressure-eye-health/', keyword: 'high blood pressure eyes', secondary: ["hypertension vision loss", "retinopathy symptoms", "blood pressure effects on eyes for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-12' },
    { id: 34, title: 'Telehealth and Remote Blood Pressure Monitoring: The Future Is Now', slug: '/blog/telehealth-blood-pressure-management/', keyword: 'remote blood pressure monitoring', secondary: ["telehealth blood pressure monitoring", "home blood pressure monitoring for seniors", "blood pressure tracking app for elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-15' },
    { id: 35, title: 'Managing Blood Pressure While Traveling: A Senior\', slug: '/blog/blood-pressure-travel-tips/', keyword: 'blood pressure travel tips for seniors', secondary: ["traveling with hypertension seniors", "senior travel health", "managing blood pressure on vacation elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-18' },
    { id: 36, title: 'Preventing Heart Failure: Why Blood Pressure Control Is Your Best Defense', slug: '/blog/heart-failure-prevention-seniors/', keyword: 'prevent heart failure', secondary: ["blood pressure control", "heart health seniors", "hypertension management for elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-21' },
    { id: 37, title: 'Beet Juice for Blood Pressure: The Science Behind the Superfood', slug: '/blog/beet-juice-nitrates-science/', keyword: 'beet juice blood pressure', secondary: ["nitrate nitric oxide pathway", "natural blood pressure remedies", "how to lower blood pressure with food for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-24' },
    { id: 38, title: 'Social Connection and Heart Health: Loneliness as a Cardiovascular Risk Factor', slug: '/blog/social-connection-heart-health/', keyword: 'loneliness cardiovascular risk', secondary: ["social connection heart health", "loneliness and blood pressure", "loneliness elderly cardiovascular risk"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-27' },
    { id: 39, title: 'Atrial Fibrillation and Blood Pressure: Understanding a Critical Connection', slug: '/blog/atrial-fibrillation-blood-pressure/', keyword: 'atrial fibrillation blood pressure', secondary: ["AFib and hypertension", "high blood pressure AFib connection", "managing AFib blood pressure for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-04-30' },
    { id: 40, title: 'Chronic Pain and Blood Pressure: The Overlooked Connection', slug: '/blog/chronic-pain-blood-pressure/', keyword: 'chronic pain blood pressure', secondary: ["pain and hypertension seniors", "blood pressure management pain", "understanding pain and high blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-03' },
    { id: 41, title: 'Hypertension in African American Seniors: Understanding Higher Risks and Better Approaches', slug: '/blog/hypertension-African-Americans-seniors/', keyword: 'hypertension in african american seniors', secondary: ["high blood pressure in black seniors", "african american heart health", "managing hypertension in older adults"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-06' },
    { id: 42, title: 'Resistant Hypertension: When Blood Pressure Won\', slug: '/blog/resistant-hypertension-treatment/', keyword: 'resistant hypertension', secondary: ["high blood pressure medication", "uncontrolled blood pressure", "hypertension treatment options"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-09' },
    { id: 43, title: 'High Blood Pressure in Your 50s and 60s: Why Early Control Matters Most', slug: '/blog/hypertension-younger-seniors/', keyword: 'high blood pressure in 50s', secondary: ["blood pressure control for seniors", "hypertension in older adults", "early blood pressure management"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-12' },
    { id: 44, title: 'Your Blood Pressure Log: How to Read It Like Your Doctor Does', slug: '/blog/reading-blood-pressure-chart/', keyword: 'blood pressure log', secondary: ["how to read blood pressure log", "understanding blood pressure readings", "blood pressure monitoring for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-15' },
    { id: 45, title: 'Dark Chocolate and Heart Health: Permission to Indulge (a Little)', slug: '/blog/dark-chocolate-cardiovascular-benefits/', keyword: 'dark chocolate blood pressure', secondary: ["heart health benefits of dark chocolate", "flavanols blood pressure", "eating dark chocolate for heart health"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-18' },
    { id: 46, title: 'Blood Pressure Changes with Seasons: What Seniors Need to Know', slug: '/blog/blood-pressure-changes-with-seasons-what-seniors-need-to-know/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-19' },
    { id: 47, title: 'Understanding Blood Pressure Medications for Seniors', slug: '/blog/understanding-blood-pressure-medications-for-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-19' },
    { id: 48, title: 'Understanding Blood Pressure Numbers for Seniors: A Complete Guide', slug: '/blog/understanding-blood-pressure-numbers-for-seniors-a-complete-guide/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-20' },
    { id: 49, title: 'The DASH Diet for Seniors: A Heart-Healthy Guide', slug: '/blog/the-dash-diet-for-seniors-a-heart-healthy-guide/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-20' },
    { id: 50, title: 'Normal Blood Pressure for a 70-Year-Old: What the Numbers Really Mean', slug: '/blog/normal-blood-pressure-70-year-old/', keyword: 'blood pressure monitor app for seniors', secondary: ["best blood pressure app seniors", "blood pressure tracking app elderly", "free bp app seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-21' },
    { id: 51, title: 'Normal Blood Pressure for Seniors Over 65: Complete Age Guide', slug: '/blog/normal-blood-pressure-seniors-over-65/', keyword: 'blood pressure chart seniors by age', secondary: ["normal blood pressure by age elderly", "blood pressure ranges for seniors", "bp chart 60 70 80 year old"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-21' },
    { id: 52, title: 'Best Free Blood Pressure Tracker App in 2026: Top Picks for Seniors', slug: '/blog/blood-pressure-tracker-app-free/', keyword: 'high blood pressure symptoms seniors', secondary: ["hypertension symptoms elderly", "signs of high blood pressure seniors", "silent killer hypertension"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-21' },
    { id: 53, title: 'Best Blood Pressure Monitor App for Seniors in 2025: What to Look For', slug: '/blog/blood-pressure-monitor-app-seniors/', keyword: 'DASH diet lower blood pressure seniors', secondary: ["DASH diet elderly hypertension", "blood pressure diet plan seniors", "foods to lower blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-14' },
    { id: 54, title: 'Blood Pressure Chart for Seniors by Age: What\', slug: '/blog/blood-pressure-chart-seniors-by-age/', keyword: 'how to lower blood pressure quickly seniors', secondary: ["lower blood pressure fast elderly", "immediate blood pressure reduction seniors", "lower bp naturally fast"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-16' },
    { id: 55, title: 'High Blood Pressure Symptoms in Seniors: Warning Signs You Shouldn\', slug: '/blog/high-blood-pressure-symptoms-seniors/', keyword: 'best blood pressure monitors seniors', secondary: ["best bp monitor for elderly", "senior blood pressure monitor", "accurate blood pressure monitor seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-18' },
    { id: 56, title: 'DASH Diet for Seniors: How to Lower Blood Pressure Through Food', slug: '/blog/dash-diet-lower-blood-pressure-seniors/', keyword: 'white coat hypertension seniors', secondary: ["white coat syndrome elderly", "high blood pressure at doctor normal at home", "white coat effect seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-19' },
    { id: 57, title: 'How to Lower Blood Pressure Quickly: 7 Proven Methods for Seniors', slug: '/blog/how-to-lower-blood-pressure-quickly/', keyword: 'orthostatic hypotension elderly', secondary: ["dizziness when standing elderly", "standing blood pressure drop seniors", "postural hypotension seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-20' },
    { id: 58, title: 'Best Blood Pressure Monitors for Seniors in 2025: Expert Guide', slug: '/blog/best-blood-pressure-monitors-seniors/', keyword: 'how to read blood pressure monitor', secondary: ["blood pressure monitor numbers explained", "what do blood pressure numbers mean", "how to use blood pressure monitor seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-22' },
    { id: 59, title: 'White Coat Hypertension in Seniors: What It Is and How to Manage It', slug: '/blog/white-coat-hypertension-seniors/', keyword: 'best blood pressure app iphone', secondary: ["best blood pressure app android", "free blood pressure tracking app", "blood pressure monitor app smartphone"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-23' },
    { id: 60, title: 'Orthostatic Hypotension in the Elderly: Why Standing Up Causes Dizziness', slug: '/blog/orthostatic-hypotension-elderly/', keyword: 'blood pressure medication side effects seniors', secondary: ["antihypertensive side effects elderly", "bp medication side effects elderly", "blood pressure pills side effects seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-24' },
    { id: 61, title: 'How to Read a Blood Pressure Monitor: Complete Guide for Seniors', slug: '/blog/how-to-read-blood-pressure-monitor/', keyword: 'systolic vs diastolic blood pressure', secondary: ["systolic vs diastolic seniors", "top number blood pressure meaning", "bottom number blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-25' },
    { id: 62, title: 'Best Blood Pressure App for iPhone and Android 2025 (Free Options Compared)', slug: '/blog/best-blood-pressure-app-iphone-android/', keyword: 'blood pressure log printable seniors', secondary: ["blood pressure tracking log elderly", "bp log sheet seniors", "blood pressure diary for seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-26' },
    { id: 63, title: 'Blood Pressure Medication Side Effects in Seniors: What to Watch For', slug: '/blog/blood-pressure-medications-side-effects-seniors/', keyword: 'best time to take blood pressure', secondary: ["when to take blood pressure reading seniors", "morning vs evening blood pressure", "blood pressure measurement time seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-27' },
    { id: 64, title: 'Systolic vs Diastolic Blood Pressure: What Each Number Means for Seniors', slug: '/blog/systolic-vs-diastolic-blood-pressure/', keyword: 'blood pressure after eating seniors', secondary: ["postprandial hypotension elderly", "low blood pressure after meals seniors", "dizziness after eating elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-28' },
    { id: 65, title: 'Blood Pressure Log for Seniors: Track Readings Daily (Free Printable + App)', slug: '/blog/blood-pressure-log-printable-seniors/', keyword: 'hypertension stage 1 vs stage 2', secondary: ["stage 1 hypertension treatment seniors", "stage 2 hypertension elderly", "blood pressure stages seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-29' },
    { id: 66, title: 'Best Time to Take Blood Pressure: Morning vs Evening for Seniors', slug: '/blog/best-time-take-blood-pressure-reading/', keyword: 'sudden blood pressure spike seniors', secondary: ["blood pressure spike causes elderly", "what causes blood pressure to spike", "high blood pressure sudden spike seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-30' },
    { id: 67, title: 'Blood Pressure After Eating in Seniors: Managing Postprandial Hypotension', slug: '/blog/postprandial-hypotension-seniors/', keyword: 'sodium blood pressure seniors', secondary: ["how much sodium per day seniors hypertension", "reduce salt blood pressure elderly", "low sodium diet seniors blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2025-05-31' },
    { id: 68, title: 'Hypertension Stage 1 vs Stage 2 in Seniors: What Your Diagnosis Means', slug: '/blog/hypertension-stage-1-vs-stage-2-seniors/', keyword: 'apple watch blood pressure seniors', secondary: ["can apple watch measure blood pressure", "smartwatch blood pressure seniors", "apple watch heart health seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-01' },
    { id: 69, title: 'Sudden Blood Pressure Spike: Causes and What Seniors Should Do', slug: '/blog/blood-pressure-spike-causes-seniors/', keyword: 'exercise lower blood pressure seniors', secondary: ["safe exercise for seniors with hypertension", "blood pressure exercise seniors", "walking blood pressure elderly"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-02' },
    { id: 70, title: 'How Much Sodium Per Day for Seniors with High Blood Pressure', slug: '/blog/sodium-blood-pressure-seniors-guide/', keyword: 'magnesium blood pressure seniors', secondary: ["magnesium supplement hypertension elderly", "magnesium lower blood pressure seniors", "best magnesium for blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-03' },
    { id: 71, title: 'Apple Watch and Blood Pressure: What Seniors Need to Know in 2025', slug: '/blog/apple-watch-blood-pressure-seniors/', keyword: 'best blood pressure monitors for seniors', secondary: ["blood pressure monitor for elderly", "most accurate home blood pressure monitor seniors", "easy to use blood pressure monitor old adults"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-04' },
    { id: 72, title: 'Safe Exercise to Lower Blood Pressure for Seniors: A Complete Guide', slug: '/blog/blood-pressure-exercise-seniors/', keyword: 'vitamins for blood pressure seniors', secondary: ["supplements lower blood pressure", "CoQ10 blood pressure", "vitamin D blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-05' },
    { id: 73, title: 'Magnesium for Blood Pressure in Seniors: What the Research Says', slug: '/blog/magnesium-blood-pressure-seniors/', keyword: 'menopause high blood pressure', secondary: ["blood pressure after menopause", "women hypertension over 60", "postmenopausal hypertension"], product: 'SnapVitals', file: '', status: 'published', date: '2025-06-06' },
    { id: 74, title: 'Best Blood Pressure Monitors for Seniors in 2026: A Complete Buying Guide', slug: '/blog/best-blood-pressure-monitors-seniors/', keyword: 'anxiety high blood pressure seniors', secondary: ["anxiety blood pressure spike", "does anxiety cause hypertension", "measurement anxiety blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-20' },
    { id: 75, title: 'Vitamins and Supplements That Help Lower Blood Pressure in Seniors', slug: '/blog/blood-pressure-vitamins-supplements-seniors/', keyword: 'high blood pressure dementia risk', secondary: ["hypertension cognitive decline", "blood pressure brain health seniors", "lower blood pressure prevent dementia"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 76, title: 'Menopause and Blood Pressure: What Every Woman Over 60 Needs to Know', slug: '/blog/blood-pressure-women-menopause-seniors/', keyword: 'hibiscus tea blood pressure', secondary: ["hibiscus tea lower blood pressure seniors", "natural tea for blood pressure", "how much hibiscus tea for blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 77, title: 'Anxiety and Blood Pressure in Seniors: Breaking the Worry Cycle', slug: '/blog/blood-pressure-anxiety-connection-seniors/', keyword: 'blood pressure different in each arm', secondary: ["which arm to measure blood pressure", "interarm blood pressure difference seniors", "blood pressure left arm vs right arm"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 78, title: 'High Blood Pressure and Dementia Risk: What Seniors Must Know', slug: '/blog/blood-pressure-dementia-cognitive-decline/', keyword: 'second blood pressure reading lower', secondary: ["why second BP reading lower", "blood pressure first reading high second low", "which blood pressure reading to use"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 79, title: 'Hibiscus Tea and Blood Pressure: Does It Really Work for Seniors?', slug: '/blog/hibiscus-tea-blood-pressure-seniors/', keyword: 'garlic blood pressure seniors', secondary: ["garlic lower blood pressure", "garlic supplement hypertension", "how much garlic for blood pressure"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 80, title: 'Different Blood Pressure in Each Arm: What It Means for Seniors', slug: '/blog/blood-pressure-both-arms-different/', keyword: 'high blood pressure headache seniors', secondary: ["hypertension headache", "blood pressure headache symptoms", "when does high BP cause headaches"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 81, title: 'Why Is My Second Blood Pressure Reading Always Lower? The Science Explained', slug: '/blog/blood-pressure-second-reading-lower/', keyword: 'cold weather blood pressure seniors', secondary: ["winter blood pressure spike", "blood pressure cold temperature", "snow shoveling blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 82, title: 'Garlic and Blood Pressure: What the Science Says for Seniors', slug: '/blog/garlic-blood-pressure-seniors/', keyword: 'accurate blood pressure reading seniors', secondary: ["blood pressure measurement mistakes", "how to get accurate blood pressure reading", "blood pressure reading tips seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 83, title: 'Does High Blood Pressure Cause Headaches in Seniors?', slug: '/blog/blood-pressure-headache-seniors/', keyword: 'best blood pressure monitor seniors 2025', secondary: ["how to choose blood pressure monitor seniors", "blood pressure monitor buying guide", "validated blood pressure monitor"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 84, title: '10 Blood Pressure Measurement Mistakes That Give Inaccurate Readings', slug: '/blog/blood-pressure-cold-weather-seniors/', keyword: 'walking lower blood pressure seniors', secondary: ["how walking lowers blood pressure", "30 minutes walking blood pressure", "walking exercise hypertension seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 85, title: 'How to Choose the Best Blood Pressure Monitor for Seniors (2025 Guide)', slug: '/blog/blood-pressure-measurement-mistakes-seniors/', keyword: 'blood pressure kidney disease seniors', secondary: ["hypertension chronic kidney disease", "CKD blood pressure management seniors", "blood pressure target kidney disease"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 86, title: 'Walking 30 Minutes a Day: The Exact Effect on Senior Blood Pressure', slug: '/blog/blood-pressure-monitor-buying-guide-seniors-2025/', keyword: 'sleep blood pressure seniors', secondary: ["poor sleep hypertension", "sleep apnea blood pressure", "how sleep affects blood pressure seniors"], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 87, title: 'Managing Blood Pressure With Kidney Disease: A Senior\', slug: '/blog/walking-lower-blood-pressure-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 88, title: 'Sleep and Blood Pressure: Why Poor Sleep Raises Hypertension Risk in Seniors', slug: '/blog/blood-pressure-kidney-disease-seniors-guide/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 89, title: 'Blood Pressure Morning vs. Evening: What Seniors and Caregivers Need to Know', slug: '/blog/blood-pressure-sleep-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-05-22' },
    { id: 90, title: 'Understanding Your Blood Pressure: A Guide and Age Chart for Seniors', slug: '/blog/blood-pressure-morning-vs-evening-readings/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 91, title: 'Understanding Low Blood Pressure Symptoms in Seniors: A Comprehensive Guide', slug: '/blog/blood-pressure-age-chart-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 92, title: 'Understanding White Coat Hypertension: The Power of Home Monitoring for Seniors', slug: '/blog/low-blood-pressure-seniors-symptoms/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 93, title: 'Navigating the Link Between Blood Pressure and Anxiety in Seniors', slug: '/blog/white-coat-hypertension-home-monitoring/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 94, title: 'Unlocking Better Health: The Best Time to Take Blood Pressure Medication for Seniors', slug: '/blog/blood-pressure-anxiety-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 95, title: 'Why Your Blood Pressure Drops When Standing: A Guide for Seniors', slug: '/blog/best-time-take-blood-pressure-medication/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 96, title: 'Is Your Blood Pressure Cuff the Wrong Size? Why It Matters for Accurate Readings', slug: '/blog/blood-pressure-standing-up-dizzy-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 97, title: 'Wrist vs. Upper Arm Blood Pressure Monitor for Seniors: Making the Right Choice', slug: '/blog/blood-pressure-cuff-too-tight-wrong-size/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 98, title: 'Finding the Best Blood Pressure App for iPhone: Free Solutions for Seniors', slug: '/blog/wrist-vs-upper-arm-blood-pressure-monitor/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 99, title: 'Your Guide to a Free Blood Pressure Log PDF: Easy Tracking for Seniors', slug: '/blog/blood-pressure-app-iphone-free/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-05' },
    { id: 100, title: 'Seamlessly Share Blood Pressure Records with Your Doctor: A Guide for Seniors and Caregivers', slug: '/blog/blood-pressure-log-pdf-free-printable/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-06' },
    { id: 101, title: 'Understanding Blood Pressure After Exercise: A Guide for Seniors', slug: '/blog/share-blood-pressure-records-doctor/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-06' },
    { id: 102, title: 'The Hidden Link: How Dehydration Affects Blood Pressure in Seniors', slug: '/blog/blood-pressure-after-exercise-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-07' },
    { id: 103, title: 'Calm Your Heart: Effective Stress Reduction for Lower Blood Pressure in Seniors', slug: '/blog/blood-pressure-dehydration-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-07' },
    { id: 104, title: 'Seniors: Unlock Lower Blood Pressure with Potassium-Rich Foods', slug: '/blog/blood-pressure-stress-reduction-techniques/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-08' },
    { id: 105, title: 'Seamless Journeys: Blood Pressure Management While Traveling for Seniors', slug: '/blog/potassium-foods-blood-pressure-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-09' },
    { id: 106, title: 'Dual Challenge: Managing High Blood Pressure and Diabetes in Seniors', slug: '/blog/blood-pressure-travel-seniors-tips/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-09' },
    { id: 107, title: 'The Critical Link: Blood Pressure, Heart Failure, and Monitoring in Seniors', slug: '/blog/hypertension-diabetes-seniors-dual-management/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-09' },
    { id: 108, title: 'Revolutionizing Home Health: The Blood Pressure Scanner App Camera for Seniors', slug: '/blog/blood-pressure-heart-failure-seniors/', keyword: '', secondary: [], product: 'SnapVitals', file: '', status: 'published', date: '2026-06-10' },
  ],
}

function deriveSiteDomain(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1].replace(/^www\./, '')
  try { return new URL(siteUrl).hostname.replace(/^www\./, '') } catch { return siteUrl }
}

interface SEOActivityProps { siteUrl?: string }

export default function SEOActivity({ siteUrl = '' }: SEOActivityProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'log' | 'articles'>('trends')
  const [keywords, setKeywords] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [optimizations, setOptimizations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKws, setSelectedKws] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Articles tab state — MUST be at component level (not inside render/IIFE)
  const [articleExpId, setArticleExpId] = useState<number | null>(null)
  const [articleStats, setArticleStats] = useState<Record<string, { clicks: number; impressions: number; position: number; ctr: number }>>({})
  const [articleStatsLoading, setArticleStatsLoading] = useState(false)
  const [articleStatsError, setArticleStatsError] = useState<string | null>(null)
  const [articleKeywords, setArticleKeywords] = useState<Record<string, any[]>>({})
  const [articleKwLoading, setArticleKwLoading] = useState<Record<string, boolean>>({})

  const kwSite  = deriveKwSite(siteUrl)
  const optSite = deriveOptSite(siteUrl)

  useEffect(() => { loadData() }, [siteUrl])

  useEffect(() => {
    if (activeTab === 'articles' && siteUrl && Object.keys(articleStats).length === 0 && !articleStatsLoading) {
      fetchArticleStats()
    }
  }, [activeTab, siteUrl])

  const loadData = async () => {
    setLoading(true)
    try {
      const [kwRes, histRes, optRes] = await Promise.all([
        supabase
          .from('keyword_tracking')
          .select('keyword, current_position, previous_position, clicks, impressions, ctr, last_checked, is_active, position_change')
          .eq('site_domain', kwSite)
          .eq('is_active', true)
          .order('current_position', { ascending: true, nullsFirst: false }),
        supabase
          .from('keyword_tracking_history')
          .select('keyword, position, impressions, clicks, recorded_at, date_range_start')
          .eq('site_domain', kwSite)
          .not('position', 'is', null)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('blog_seo_optimizations')
          .select('id, slug, title, original_excerpt, optimized_excerpt, target_keywords, meta_description, ai_suggestions, status, created_at')
          .ilike('site_domain', `%${optSite}%`)
          .order('created_at', { ascending: false })
      ])
      setKeywords(kwRes.data || [])
      setHistory(histRes.data || [])
      setOptimizations(optRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchArticleStats = async () => {
    if (!siteUrl) return
    setArticleStatsLoading(true)
    setArticleStatsError(null)
    try {
      const token = await getValidToken()
      if (!token) { setArticleStatsError('Not authenticated'); return }
      const endDate = new Date().toISOString().slice(0, 10)
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const rows = await gscApi.topPages(token, { siteUrl, startDate, endDate, rowLimit: 500 })
      const stats: Record<string, any> = {}
      rows.forEach((row: any) => {
        try {
          const path = new URL(row.page).pathname
          stats[path] = { clicks: row.clicks, impressions: row.impressions, position: row.position, ctr: row.ctr }
        } catch {
          stats[row.page] = { clicks: row.clicks, impressions: row.impressions, position: row.position, ctr: row.ctr }
        }
      })
      setArticleStats(stats)
    } catch (e: any) {
      console.error('Article stats fetch failed:', e)
      setArticleStatsError(e?.message || 'Failed to load GSC data')
    } finally {
      setArticleStatsLoading(false)
    }
  }

  // 自动检测单篇文章关键词排名
  const fetchPageKeywords = async (article: any) => {
    if (!siteUrl || articleKwLoading[article.slug]) return
    setArticleKwLoading(prev => ({ ...prev, [article.slug]: true }))
    try {
      const token = await getValidToken()
      if (!token) return
      const endDate = new Date().toISOString().slice(0, 10)
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const siteHost = (() => { try { return new URL(siteUrl.startsWith('sc-domain:') ? `https://${siteUrl.replace('sc-domain:', '')}` : siteUrl).origin } catch { return siteUrl } })()
      const pageUrl = `${siteHost}${article.slug}`
      const rows = await gscApi.pageKeywords(token, { siteUrl, pageUrl, startDate, endDate, rowLimit: 10 })
      setArticleKeywords(prev => ({ ...prev, [article.slug]: rows }))
    } catch (e) {
      console.error('pageKeywords fetch failed:', e)
    } finally {
      setArticleKwLoading(prev => ({ ...prev, [article.slug]: false }))
    }
  }

  const buildChartData = () => {
    const kwsToShow = selectedKws.length > 0 ? selectedKws : keywords.filter(k => k.current_position).slice(0, 5).map((k: any) => k.keyword)
    const dateMap: Record<string, Record<string, number>> = {}
    history
      .filter((h: any) => kwsToShow.includes(h.keyword) && h.position)
      .forEach((h: any) => {
        const date = h.date_range_start?.slice(0, 10) || h.recorded_at?.slice(0, 10)
        if (!dateMap[date]) dateMap[date] = {}
        dateMap[date][h.keyword] = parseFloat(parseFloat(h.position).toFixed(1))
      })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }

  const chartData = buildChartData()
  const kwsWithPos = keywords.filter(k => k.current_position)
  const kwsToShow = selectedKws.length > 0 ? selectedKws : kwsWithPos.slice(0, 5).map((k: any) => k.keyword)
  const filteredKws = keywords.filter(k => k.keyword.toLowerCase().includes(search.toLowerCase()))
  const toggleKw = (kw: string) =>
    setSelectedKws(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw].slice(0, 8))
  const improved = keywords.filter(k => k.position_change != null && k.position_change > 0).length
  const declined = keywords.filter(k => k.position_change != null && k.position_change < 0).length
  const pColor: Record<string, string> = { MileFlask: '#6366f1', WinEye: '#06b6d4', EggSentry: '#f59e0b', XD1: '#8b5cf6' }

  // Derive articles for the current site
  const siteDomain = deriveSiteDomain(siteUrl)
  const ARTICLES = ARTICLES_REGISTRY[siteDomain] ?? []
  const wpAdminUrl = siteUrl
    ? `https://${siteDomain}/wp-admin/`
    : 'https://www.showmo365.com/wp-admin/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 12px', alignSelf: 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{badgeLabel(siteUrl)}</span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {[['trends', '📈 Keyword Trends'], ['log', '📋 SEO Optimization Log'], ['articles', '📝 Blog Articles']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v as any)}
            style={{ padding: '7px 18px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              borderColor: activeTab === v ? '#6366f1' : '#e2e8f0',
              background: activeTab === v ? '#6366f1' : '#fff',
              color: activeTab === v ? '#fff' : '#64748b' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Tracked Keywords', value: keywords.length, color: '#6366f1', bg: '#ede9fe' },
              { label: 'Ranked (have position)', value: kwsWithPos.length, color: '#2563eb', bg: '#dbeafe' },
              { label: 'Improved ↑', value: improved, color: '#16a34a', bg: '#dcfce7' },
              { label: 'Declined ↓', value: declined, color: '#ef4444', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ ...card, padding: '20px 22px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Position History</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Lower = better. Click keywords in table below to add to chart (max 8).</p>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                No history data with positions yet — GSC sync runs weekly (Mon UTC 02:00).<br />
                Only keywords that appear in GSC will have position data.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis reversed domain={['auto','auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: any, n: string) => [`#${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {kwsToShow.map((kw, i) => (
                    <Line key={kw} type="monotone" dataKey={kw} name={kw}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>Current vs Previous Position</h3>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
                  style={{ paddingLeft: 28, height: 32, width: 160, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#374151', outline: 'none' }} />
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                  <tr>
                    {['', 'Keyword', 'Current Pos', 'Previous Pos', 'Change', 'Clicks', 'Impressions', 'Last Synced'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</td></tr>
                  ) : filteredKws.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No keyword data yet</td></tr>
                  ) : filteredKws.map((row: any, i: number) => {
                    const selected = selectedKws.includes(row.keyword) || (selectedKws.length === 0 && i < 5)
                    const delta = row.position_change
                    return (
                      <tr key={row.keyword} onClick={() => toggleKw(row.keyword)}
                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: selected ? COLORS[kwsToShow.indexOf(row.keyword) % COLORS.length] : '#e2e8f0' }} />
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151', maxWidth: 220 }}>{row.keyword}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {row.current_position
                            ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: row.current_position <= 3 ? '#dcfce7' : row.current_position <= 10 ? '#dbeafe' : '#f8fafc',
                                color: row.current_position <= 3 ? '#16a34a' : row.current_position <= 10 ? '#2563eb' : '#94a3b8' }}>
                                #{parseFloat(row.current_position).toFixed(0)}
                              </span>
                            : <span style={{ color: '#94a3b8', fontSize: 12 }}>Not ranked</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 12 }}>
                          {row.previous_position ? `#${parseFloat(row.previous_position).toFixed(0)}` : '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {delta == null ? <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            : delta > 0 ? <span style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingUp size={13} />+{parseFloat(delta).toFixed(0)}</span>
                            : delta < 0 ? <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingDown size={13} />{parseFloat(delta).toFixed(0)}</span>
                            : <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><Minus size={13} />0</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#374151', fontWeight: 600 }}>{row.clicks?.toLocaleString() ?? '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{row.impressions?.toLocaleString() ?? '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{row.last_checked?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── SEO LOG TAB ── */}
      {activeTab === 'log' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: 'Optimized Articles', value: optimizations.length, color: '#6366f1', bg: '#ede9fe', icon: <FileText size={16} color="#6366f1" /> },
              { label: 'With AI Suggestions', value: optimizations.filter((o: any) => o.ai_suggestions).length, color: '#16a34a', bg: '#dcfce7', icon: <Lightbulb size={16} color="#16a34a" /> },
              { label: 'With Meta Description', value: optimizations.filter((o: any) => o.meta_description).length, color: '#d97706', bg: '#fef3c7', icon: <AlignLeft size={16} color="#d97706" /> },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Blog SEO Optimizations</h3>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Target keywords, optimized excerpts and AI suggestions per article</p>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {optimizations.map((opt: any) => (
                  <div key={opt.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <div onClick={() => setExpandedRow(expandedRow === opt.id ? null : opt.id)}
                      style={{ padding: '12px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{opt.title || opt.slug}</span>
                          {opt.status && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: opt.status === 'applied' ? '#dcfce7' : '#fef9c3',
                              color: opt.status === 'applied' ? '#16a34a' : '#ca8a04' }}>
                              {opt.status}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(Array.isArray(opt.target_keywords) ? opt.target_keywords.slice(0, 3) : []).map((kw: string) => (
                            <span key={kw} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#ede9fe', color: '#6366f1' }}>{kw}</span>
                          ))}
                        </div>
                        {opt.optimized_excerpt && (
                          <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                            {opt.optimized_excerpt}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{opt.created_at?.slice(0, 10)}</span>
                        {expandedRow === opt.id ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                      </div>
                    </div>
                    {expandedRow === opt.id && (
                      <div style={{ padding: '0 18px 16px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                        {opt.meta_description && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meta Description</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{opt.meta_description}</p>
                          </div>
                        )}
                        {opt.optimized_excerpt && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimized Excerpt</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{opt.optimized_excerpt}</p>
                          </div>
                        )}
                        {opt.ai_suggestions && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Suggestions</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {typeof opt.ai_suggestions === 'string' ? opt.ai_suggestions : JSON.stringify(opt.ai_suggestions, null, 2)}
                            </p>
                          </div>
                        )}
                        {opt.target_keywords?.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#d97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Target Keywords</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {opt.target_keywords.map((kw: string) => (
                                <span key={kw} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BLOG ARTICLES TAB ── */}
      {activeTab === 'articles' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Total Articles',          value: ARTICLES.length,                                                                             color: '#6366f1', bg: '#ede9fe' },
              { label: 'Ready to Publish',         value: ARTICLES.filter(a => a.status === 'ready').length,                                          color: '#16a34a', bg: '#dcfce7' },
              { label: 'Indexed by Google',        value: ARTICLES.filter(a => (articleStats[a.slug]?.impressions ?? 0) > 0).length,                  color: '#0891b2', bg: '#e0f2fe' },
              { label: 'Total GSC Clicks (90d)',   value: ARTICLES.reduce((sum, a) => sum + (articleStats[a.slug]?.clicks ?? 0), 0),                  color: '#d97706', bg: '#fef3c7' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '14px 18px', background: '#f8faff', border: '1px solid #e0e7ff' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Keywords Coverage</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ARTICLES.map(a => {
                const kwData = keywords.find(k => k.keyword.toLowerCase() === a.keyword.toLowerCase())
                return (
                  <span key={a.id} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: pColor[a.product] + '18', color: pColor[a.product], border: `1px solid ${pColor[a.product]}30`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    🎯 {a.keyword}
                    {kwData?.current_position
                      ? <span style={{ background: pColor[a.product], color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>#{Math.round(kwData.current_position)}</span>
                      : <span style={{ background: '#e2e8f0', color: '#94a3b8', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>not ranked</span>
                    }
                  </span>
                )
              })}
            </div>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>WordPress Blog Articles</h3>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>GSC 数据来自近 90 天 · 点击行展开查看详细关键词策略与流量</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {articleStatsLoading && (
                  <span style={{ fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={12} /> Loading GSC…
                  </span>
                )}
                {articleStatsError && !articleStatsLoading && (
                  <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ {articleStatsError}</span>
                )}
                <button onClick={fetchArticleStats} disabled={articleStatsLoading}
                  style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', cursor: articleStatsLoading ? 'not-allowed' : 'pointer', padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#fff', opacity: articleStatsLoading ? 0.5 : 1 }}>
                  ↻ Refresh GSC
                </button>
                <a href={wpAdminUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', textDecoration: 'none', padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#fff' }}>
                  → WP Admin
                </a>
              </div>
            </div>

            {ARTICLES.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>📭</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>No articles for {siteDomain} yet</p>
                <p style={{ fontSize: 12 }}>Add articles to <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>ARTICLES_REGISTRY['{siteDomain}']</code> in SEOActivity.tsx</p>
              </div>
            ) : ARTICLES.map((a, i) => {
              const gsc = articleStats[a.slug]
              const kwData = keywords.find(k => k.keyword.toLowerCase() === a.keyword.toLowerCase())
              const statsLoaded = Object.keys(articleStats).length > 0
              const indexed = statsLoaded ? (gsc && gsc.impressions > 0 ? 'yes' : 'no') : 'unknown'

              return (
                <div key={a.id} style={{ borderBottom: i < ARTICLES.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div onClick={() => { const newId = articleExpId === a.id ? null : a.id; setArticleExpId(newId); if (newId !== null && !articleKeywords[a.slug]) fetchPageKeywords(a) }}
                    style={{ padding: '13px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: pColor[a.product] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: pColor[a.product] }}>
                      {a.id}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{a.title}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: pColor[a.product] + '18', color: pColor[a.product] }}>{a.product}</span>
                        {indexed === 'yes'
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> Indexed</span>
                          : indexed === 'no'
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#ca8a04', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> Not indexed yet</span>
                          : <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertCircle size={10} /> Pending check</span>
                        }
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>✓ {a.status}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Focus:</span>
                          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6366f1' }}>{a.keyword}</span>
                          {kwData?.current_position && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#2563eb' }}>
                              Rank #{Math.round(kwData.current_position)}
                            </span>
                          )}
                        </div>
                        {gsc && (
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
                            <span>👆 <strong style={{ color: '#374151' }}>{gsc.clicks}</strong> clicks</span>
                            <span>👁 <strong style={{ color: '#374151' }}>{gsc.impressions.toLocaleString()}</strong> impr</span>
                            {gsc.position > 0 && <span>📍 pos <strong style={{ color: '#374151' }}>#{gsc.position.toFixed(1)}</strong></span>}
                          </div>
                        )}
                        {!gsc && statsLoaded && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>No GSC data — not live yet</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.date}</span>
                      {articleExpId === a.id ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                    </div>
                  </div>

                  {articleExpId === a.id && (
                    <div style={{ padding: '0 18px 20px 58px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                      {gsc && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14, marginBottom: 14 }}>
                          {[
                            { label: 'Clicks (90d)',      value: gsc.clicks.toLocaleString(),                              color: '#6366f1' },
                            { label: 'Impressions (90d)', value: gsc.impressions.toLocaleString(),                          color: '#0891b2' },
                            { label: 'Avg Position',      value: gsc.position > 0 ? `#${gsc.position.toFixed(1)}` : '—',   color: '#d97706' },
                            { label: 'CTR',               value: gsc.ctr > 0 ? `${(gsc.ctr * 100).toFixed(2)}%` : '—',    color: '#16a34a' },
                          ].map(s => (
                            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                              <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {kwData && (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyword Tracking (Supabase)</p>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#374151' }}>
                            <span>Position: <strong>{kwData.current_position ? `#${Math.round(kwData.current_position)}` : 'Not ranked'}</strong></span>
                            <span>Prev: <strong>{kwData.previous_position ? `#${Math.round(kwData.previous_position)}` : '—'}</strong></span>
                            <span>Clicks: <strong>{kwData.clicks ?? '—'}</strong></span>
                          </div>
                          {/* 自动检测关键词排名 */}
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                              🔍 实时关键词排名（GSC 90天）
                              {articleKwLoading[a.slug] && <span style={{ fontSize: 10, color: '#94a3b8' }}>加载中...</span>}
                            </div>
                            {articleKeywords[a.slug]?.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead><tr style={{ background: '#f8fafc' }}>
                                  <th style={{ padding: '4px 8px', textAlign: 'left', color: '#64748b' }}>关键词</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>排名</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>点击</th>
                                  <th style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>展示</th>
                                </tr></thead>
                                <tbody>{articleKeywords[a.slug].map((kw: any, ki: number) => (
                                  <tr key={ki} style={{ borderTop: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '4px 8px', color: '#374151' }}>{kw.keyword}</td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                      <span style={{ background: kw.position <= 3 ? '#dcfce7' : kw.position <= 10 ? '#dbeafe' : '#f8fafc', color: kw.position <= 3 ? '#16a34a' : kw.position <= 10 ? '#2563eb' : '#94a3b8', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                                        #{kw.position?.toFixed(1)}
                                      </span>
                                    </td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center', color: '#374151' }}>{kw.clicks}</td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center', color: '#94a3b8' }}>{kw.impressions}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            ) : !articleKwLoading[a.slug] && (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>暂无排名数据（文章可能尚未被 Google 收录）</span>
                            )}
                          </div>
                          <div style={{ display: 'none' }}>
                            <span>Impressions: <strong>{kwData.impressions ?? '—'}</strong></span>
                            <span>Last synced: <strong>{kwData.last_checked?.slice(0, 10) ?? '—'}</strong></span>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secondary Keywords</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {a.secondary.map(kw => (
                              <span key={kw} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>{kw}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upload Reference</p>
                          <code style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 5, color: '#374151' }}>{a.file}</code>
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>WordPress → Code Editor → Paste HTML → Add Schema block</p>
                          <a href={`https://${siteDomain}${a.slug}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                            🔗 {`https://${siteDomain}${a.slug}`}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
