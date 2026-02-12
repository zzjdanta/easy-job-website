/* CV Editor – form, steps, CV generation, cover letter. Set DEEPSEEK_API_KEY below for AI features. */
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const DEEPSEEK_API_KEY = 'sk-45a75bfb45174903ada13c17ceb828d4'; // Set your key here for AI suggestions and cover letter

const url = new URLSearchParams(location.search);
const tmplFromUrl = url.get('template') || 'black-white';

let step = 1;

function updateStep() { document.getElementById('cur').textContent = step; }

function next() {
  if (step < 7) {
    document.getElementById('step' + step).classList.remove('active');
    step++;
    document.getElementById('step' + step).classList.add('active');
    updateStep();
  }
}
function prev() {
  if (step > 1) {
    document.getElementById('step' + step).classList.remove('active');
    step--;
    document.getElementById('step' + step).classList.add('active');
    updateStep();
  }
}

document.getElementById('skillIn').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.value.trim()) {
    const s = document.createElement('span');
    s.className = 'tag';
    s.innerHTML = e.target.value.trim() + ' <span class="remove" onclick="this.parentElement.remove()">×</span>';
    document.getElementById('skillsBox').appendChild(s);
    e.target.value = '';
  }
});

function addLang() {
  const d = document.createElement('div');
  d.className = 'flex gap-3 mb-3';
  d.innerHTML = '<input type="text" placeholder="Language" class="border rounded px-3 py-2 flex-1">' +
    '<select class="border rounded px-3 py-2"><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Fluent</option><option>Native</option></select>' +
    '<span class="remove" onclick="this.parentElement.remove()">×</span>';
  document.getElementById('langBox').appendChild(d);
}

function addEdu() { addBlock('eduBox', 'Degree', 'University', 'Start', 'End', 'Description', false); }
function addExp() { addBlock('expBox', 'Job Title', 'Company', 'Start', 'End', 'Responsibilities', true); }

function addBlock(box, title1, title2, start, end, desc, isExp) {
  const div = document.createElement('div');
  div.className = 'border rounded-lg p-5 mb-5 relative' + (isExp ? ' exp-block' : '');
  div.innerHTML = '<span class="remove absolute top-2 right-2" onclick="this.parentElement.remove()">×</span>' +
    '<input placeholder="' + title1 + '" class="border rounded w-full mb-3 px-3 py-2">' +
    '<input placeholder="' + title2 + '" class="border rounded w-full mb-3 px-3 py-2">' +
    '<div class="grid grid-cols-2 gap-4 mb-3">' +
    '<input placeholder="' + start + ' (e.g. 2020)" class="border rounded px-3 py-2">' +
    '<input placeholder="' + end + ' (e.g. 2024 or Present)" class="border rounded px-3 py-2">' +
    '</div>' +
    '<textarea placeholder="' + desc + '" class="border rounded w-full h-28 px-3 py-2"></textarea>' +
    (isExp ? '<button type="button" onclick="suggestBulletsForExp(this)" class="mt-2 text-sm text-cyan-600 font-medium">Suggest bullets with AI</button>' : '');
  document.getElementById(box).appendChild(div);
}

async function suggestBulletsForExp(btn) {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) { alert('API key is not set. Set DEEPSEEK_API_KEY in cv-editor.js to use AI suggestions.'); return; }
  const block = btn.closest('.exp-block');
  if (!block) return;
  const inputs = block.querySelectorAll('input, textarea');
  const title = (inputs[0] && inputs[0].value) || '';
  const company = (inputs[1] && inputs[1].value) || '';
  const responsibilities = (inputs[4] && inputs[4].value) || '';
  const textarea = inputs[4];
  if (!title && !company) { alert('Enter at least Job Title or Company first.'); return; }
  btn.disabled = true;
  btn.textContent = 'Generating...';
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'You are a resume expert. Output only 2-3 short bullet points for a CV, one per line. Start each with a strong action verb. Be specific and achievement-focused. No preamble.' },
          { role: 'user', content: 'Job title: ' + title + '. Company: ' + company + (responsibilities ? ' Current draft: ' + responsibilities : '') + ' Generate 2-3 professional bullet points for this role.' }
        ],
        temperature: 0.5
      }),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content.trim() : '';
    if (textarea && text) textarea.value = text;
  } catch (e) {
    alert('Could not get suggestions. Check your API key and try again.');
  }
  btn.disabled = false;
  btn.textContent = 'Suggest bullets with AI';
}

async function improveAboutWithAI() {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) { alert('API key is not set. Set DEEPSEEK_API_KEY in cv-editor.js to use AI.'); return; }
  const textarea = document.getElementById('aboutTextarea');
  const current = (textarea && textarea.value) || '';
  const skills = Array.from(document.querySelectorAll('#skillsBox .tag')).map(function (t) { return t.firstChild ? t.firstChild.textContent : t.textContent; }).join(', ') || '';
  const jobTitleEl = document.querySelector('[data-key="jobTitle"]');
  const title = (jobTitleEl && jobTitleEl.value) || '';
  const btn = document.querySelector('button[onclick="improveAboutWithAI()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Improving...'; }
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'You are a resume expert. Write a short professional summary (3-4 lines) for a CV. Output only the summary, no labels or preamble.' },
          { role: 'user', content: 'Job title: ' + title + '. Skills: ' + skills + (current ? ' Current about: ' + current : '') + ' Write a concise professional summary.' }
        ],
        temperature: 0.5
      }),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content.trim() : '';
    if (textarea && text) textarea.value = text;
  } catch (e) {
    alert('Could not improve. Check your API key and try again.');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Improve with AI'; }
}

function collectCVData() {
  const cvData = {};
  document.querySelectorAll('[data-key]').forEach(function (i) { cvData[i.dataset.key] = i.value || ''; });
  cvData.fullName = ((cvData.firstName || '') + ' ' + (cvData.lastName || '')).trim();
  cvData.skills = Array.from(document.querySelectorAll('#skillsBox .tag')).map(function (t) { return t.firstChild ? t.firstChild.textContent : t.textContent; }).join(', ') || '';

  const languages = [];
  document.querySelectorAll('#langBox > div').forEach(function (b) {
    const v = b.querySelectorAll('input,select');
    languages.push({ language: v[0].value || '', level: v[1].value || '' });
  });

  const education = [];
  document.querySelectorAll('#eduBox > div').forEach(function (b) {
    const v = b.querySelectorAll('input,textarea');
    education.push({
      degree: v[0].value || '',
      university: v[1].value || '',
      start: v[2].value || '',
      end: v[3].value || 'Present',
      description: v[4].value || ''
    });
  });

  const experience = [];
  document.querySelectorAll('#expBox > div').forEach(function (b) {
    const v = b.querySelectorAll('input,textarea');
    experience.push({
      title: v[0].value || '',
      company: v[1].value || '',
      start: v[2].value || '',
      end: v[3].value || 'Present',
      responsibilities: v[4].value || ''
    });
  });

  return {
    template: tmplFromUrl,
    personalInfo: {
      fullName: cvData.fullName,
      jobTitle: cvData.jobTitle,
      email: cvData.email,
      phone: cvData.phone,
      address: cvData.address || ''
    },
    about: cvData.about,
    skills: cvData.skills,
    languages: languages,
    education: education,
    experience: experience
  };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toBullets(txt, max) {
  const raw = String(txt || '').split(/[\n•\-\t]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return raw.slice(0, max || 5).map(function (r) { return esc(r); }).filter(Boolean);
}

function shortAbout(txt) {
  const s = String(txt || '').trim();
  return esc(s.length > 140 ? s.slice(0, 137) + '...' : s);
}

function getCVTemplateHTML(templateId, data, photoDataUrl) {
  const p = data.personalInfo || {};
  const name = esc(p.fullName || '');
  const title = esc(p.jobTitle || '');
  const email = esc(p.email || '');
  const phone = esc(p.phone || '');
  const address = esc(p.address || '');
  const about = shortAbout(data.about);
  const skillsList = (data.skills || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const langList = (data.languages || []).map(function (l) { return esc(l.language) + (l.level ? ' (' + esc(l.level) + ')' : ''); });
  const eduList = data.education || [];
  const expList = data.experience || [];
  const photo = photoDataUrl ? '<img src="' + photoDataUrl + '" alt="Photo" style="width:100%;height:100%;object-fit:cover;">' : '';

  const eduItems = eduList.map(function (e) {
    return '<div style="margin-bottom:10px;"><strong>' + esc(e.degree) + '</strong><br>' + esc(e.university) + ' · ' + esc(e.start) + ' – ' + esc(e.end) + '</div>';
  }).join('');
  const expItems = expList.map(function (e) {
    const bullets = toBullets(e.responsibilities);
    const ul = bullets.length ? '<ul style="margin:6px 0 0 0;padding-left:18px;font-size:12px;line-height:1.4;">' + bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>' : '';
    return '<div style="margin-bottom:14px;"><strong>' + esc(e.title) + '</strong> · ' + esc(e.company) + ' <span style="float:right;font-size:11px;">' + esc(e.start) + ' – ' + esc(e.end) + '</span>' + ul + '</div>';
  }).join('');
  const skillsUl = '<ul style="margin:6px 0 0 0;padding-left:18px;font-size:12px;line-height:1.5;">' + skillsList.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';

  if (templateId === 'black-white') {
    return '<div class="cv-template cv-template-bw" style="font-family:sans-serif;max-width:210mm;margin:0 auto;border:1px solid #ddd;background:#fff;">' +
      '<div style="display:flex;align-items:flex-start;padding:18px 20px;gap:16px;border-bottom:1px solid #ddd;">' +
      '<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:#f0f0f0;flex-shrink:0;">' + photo + '</div>' +
      '<div style="flex:1;">' +
      '<h1 style="margin:0 0 2px 0;font-size:20px;font-weight:700;letter-spacing:0.02em;">' + name.toUpperCase() + '</h1>' +
      '<p style="margin:0 0 8px 0;font-size:13px;color:#333;">' + title + '</p>' +
      '<p style="margin:0;font-size:11px;color:#555;">' + (phone ? phone + ' · ' : '') + (email ? email : '') + (address ? ' · ' + address : '') + '</p>' +
      '</div></div>' +
      '<div style="background:#e8e8e8;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:0.05em;">PROFESSIONAL SUMMARY</div>' +
      '<div style="padding:12px 16px;font-size:12px;line-height:1.5;color:#333;">' + about + '</div>' +
      '<div style="background:#e8e8e8;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:0.05em;">SKILLS</div>' +
      '<div style="padding:12px 16px;">' + skillsUl + '</div>' +
      '<div style="background:#e8e8e8;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:0.05em;">EXPERIENCE</div>' +
      '<div style="padding:12px 16px;font-size:12px;">' + expItems + '</div>' +
      '<div style="background:#e8e8e8;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:0.05em;">EDUCATION</div>' +
      '<div style="padding:12px 16px;font-size:12px;">' + eduItems + '</div></div>';
  }

  if (templateId === 'grey-modern') {
    return '<div class="cv-template cv-template-grey" style="font-family:sans-serif;max-width:210mm;margin:0 auto;background:#eaeaea;display:flex;">' +
      '<div style="flex:1.7;padding:20px;">' +
      '<h1 style="margin:0;font-size:16px;font-weight:400;">' + (name.split(' ')[0] || name) + '</h1><h1 style="margin:0 0 6px 0;font-size:24px;font-weight:700;color:#222;">' + (name.split(' ').slice(1).join(' ') || ' ') + '</h1>' +
      '<p style="margin:0 0 14px 0;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#333;">' + title.toUpperCase() + '</p>' +
      '<p style="margin:0 0 18px 0;font-size:12px;line-height:1.45;color:#444;">' + about + '</p>' +
      '<div style="border-bottom:1px solid #bbb;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:0.05em;">EXPERIENCE</div>' + expItems +
      '<div style="border-bottom:1px solid #bbb;margin:14px 0 6px;font-size:10px;font-weight:700;letter-spacing:0.05em;">EDUCATION</div>' + eduItems +
      '</div>' +
      '<div style="width:80mm;background:#e0e0e0;padding:16px;border-left:1px solid #ccc;">' +
      '<p style="margin:0 0 8px 0;font-size:11px;">' + phone + '</p><p style="margin:0 0 8px 0;font-size:11px;">' + email + '</p><p style="margin:0 0 12px 0;font-size:11px;">' + address + '</p>' +
      '<div style="width:70px;height:70px;margin:12px auto;border-radius:6px;overflow:hidden;background:#ccc;">' + photo + '</div>' +
      '<div style="border-bottom:1px solid #bbb;margin-bottom:6px;font-size:10px;font-weight:700;">SKILLS</div>' + skillsUl +
      '<div style="border-bottom:1px solid #bbb;margin:12px 0 6px;font-size:10px;font-weight:700;">LANGUAGES</div><ul style="margin:6px 0 0 0;padding-left:16px;font-size:11px;">' + langList.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
      '</div></div>';
  }

  if (templateId === 'beige-brown') {
    return '<div class="cv-template cv-template-beige" style="font-family:sans-serif;max-width:210mm;margin:0 auto;background:#f5f0e8;">' +
      '<div style="background:linear-gradient(135deg,#4a3728 0%,#6b5344 100%);padding:20px;position:relative;">' +
      '<div style="display:flex;align-items:flex-start;gap:16px;">' +
      '<div style="width:88px;height:88px;border-radius:50%;overflow:hidden;background:#4a3728;border:3px solid rgba(255,255,255,0.3);flex-shrink:0;">' + photo + '</div>' +
      '<div style="flex:1;color:#fff;">' +
      '<h1 style="margin:0 0 2px 0;font-size:20px;font-weight:700;letter-spacing:0.02em;">' + name.toUpperCase() + '</h1>' +
      '<p style="margin:0 0 10px 0;font-size:12px;opacity:0.95;">' + title.toUpperCase() + '</p>' +
      '<p style="margin:0;font-size:11px;line-height:1.45;opacity:0.9;">' + about + '</p></div></div></div>' +
      '<div style="display:flex;">' +
      '<div style="width:72mm;padding:16px;background:#f5f0e8;">' +
      '<p style="margin:0 0 6px 0;font-size:11px;color:#4a3728;">' + phone + '</p><p style="margin:0 0 6px 0;font-size:11px;color:#4a3728;">' + email + '</p><p style="margin:0 0 12px 0;font-size:11px;color:#4a3728;">' + address + '</p>' +
      '<div style="color:#4a3728;font-size:10px;font-weight:700;letter-spacing:0.05em;margin-top:16px;">SKILLS</div>' +
      '<ul style="margin:6px 0 0 0;padding-left:14px;font-size:11px;color:#333;">' + skillsList.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<div style="color:#4a3728;font-size:10px;font-weight:700;letter-spacing:0.05em;margin-top:16px;">EDUCATION</div>' +
      '<div style="font-size:11px;margin-top:6px;">' + eduItems + '</div>' +
      '<div style="color:#4a3728;font-size:10px;font-weight:700;letter-spacing:0.05em;margin-top:16px;">LANGUAGE</div>' +
      '<p style="margin:6px 0 0 0;font-size:11px;">' + langList.join(', ') + '</p></div>' +
      '<div style="flex:1;padding:16px;border-left:1px solid #e0d8cc;font-size:12px;">' +
      '<div style="color:#4a3728;font-size:10px;font-weight:700;letter-spacing:0.05em;margin-bottom:10px;">EXPERIENCE</div>' + expItems +
      '</div></div></div>';
  }

  return getCVTemplateHTML('black-white', data, photoDataUrl);
}

function getDeepSeekApiKey() {
  return (typeof DEEPSEEK_API_KEY === 'string' && DEEPSEEK_API_KEY.trim()) || '';
}

function generateCV() {
  const cvData = collectCVData();
  if (!cvData.personalInfo.fullName || !cvData.personalInfo.jobTitle || !cvData.personalInfo.email) {
    alert('Please fill in required fields: First Name, Last Name, Job Title, and Email');
    return;
  }
  document.getElementById('cvLoading').classList.remove('hidden');
  document.getElementById('cvLoadingText').classList.remove('hidden');
  document.getElementById('cvResult').classList.add('hidden');

  function finishCV(photoDataUrl) {
    const templateId = (cvData.template || 'black-white').toLowerCase();
    const html = getCVTemplateHTML(templateId, cvData, photoDataUrl || null);
    document.getElementById('cvLoading').classList.add('hidden');
    document.getElementById('cvLoadingText').classList.add('hidden');
    document.getElementById('cvResult').classList.remove('hidden');
    document.getElementById('cvContent').innerHTML = html;
  }
  const photoInput = document.getElementById('photoInput');
  if (photoInput && photoInput.files && photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function () { finishCV(reader.result); };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    finishCV(null);
  }
}

function downloadCVPDF() {
  const cvContent = document.getElementById('cvContent');
  const templateEl = cvContent && cvContent.querySelector('.cv-template');
  if (!templateEl || !window.html2pdf) {
    alert('Generate your CV first.');
    return;
  }
  const firstName = (document.querySelector('[data-key="firstName"]') && document.querySelector('[data-key="firstName"]').value) || 'My';
  html2pdf().set({ margin: 10, filename: firstName + '_CV.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(templateEl).save();
}

async function generateCoverLetter() {
  const jobType = (document.getElementById('jobType') && document.getElementById('jobType').value) ? document.getElementById('jobType').value.trim() : '';
  const position = (document.getElementById('position') && document.getElementById('position').value) ? document.getElementById('position').value.trim() : '';
  const companyName = (document.getElementById('companyName') && document.getElementById('companyName').value) ? document.getElementById('companyName').value.trim() : '';
  if (!jobType || !position || !companyName) {
    alert('Please select Job Type, enter Position, and Company Name');
    return;
  }
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    alert('Set DEEPSEEK_API_KEY in cv-editor.js to generate cover letters.');
    return;
  }
  const cvDataObj = collectCVData();
  document.getElementById('coverLetterLoading').classList.remove('hidden');
  document.getElementById('coverLetterResult').classList.add('hidden');

  try {
    const p = cvDataObj.personalInfo || {};
    const langList = (cvDataObj.languages || []).map(function (l) { return (l.language || '') + ' (' + (l.level || '') + ')'; }).filter(Boolean).join(', ') || 'Not specified';
    const eduList = (cvDataObj.education || []).map(function (e) { return (e.degree || '') + ' at ' + (e.university || '') + ' (' + (e.start || '') + '–' + (e.end || '') + ')'; }).filter(Boolean).join('; ') || 'Not specified';
    const expList = (cvDataObj.experience || []).map(function (e) { return (e.title || '') + ' at ' + (e.company || '') + ': ' + (e.responsibilities || '').slice(0, 120) + '...'; }).filter(Boolean).join('\n') || 'Not specified';
    const userPrompt = 'Write a professional cover letter for this candidate. Use the candidate\'s own information below so the letter is specific and convincing.\n\nTarget role:\n- Job type: ' + jobType + '\n- Position: ' + position + '\n- Company: ' + companyName + '\n\nCandidate information (use these details in the letter):\n- Full name: ' + (p.fullName || '') + '\n- Current/professional title: ' + (p.jobTitle || '') + '\n- Email: ' + (p.email || '') + '; Phone: ' + (p.phone || '') + '; Address: ' + (p.address || '') + '\n- About me: ' + (cvDataObj.about || '') + '\n- Skills: ' + (cvDataObj.skills || '') + '\n- Languages: ' + langList + '\n- Education: ' + eduList + '\n- Experience: ' + expList + '\n\nWrite the cover letter based on the above. Mention specific skills, experience, or education that match the role. Output only the cover letter text. Professional tone, about one page.';
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: 'You are a professional career coach. Write clear, tailored cover letters based on the candidate profile and the job/company. Output only the cover letter.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5
      }),
      mode: 'cors'
    });
    if (!response.ok) {
      var err = 'HTTP ' + response.status;
      try {
        const data = await response.json();
        if (data.error && data.error.message) err = data.error.message;
      } catch (_) {}
      throw new Error(err);
    }
    const result = await response.json();
    const coverLetterText = (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) ? result.choices[0].message.content.trim() : '';
    if (!coverLetterText) throw new Error('Empty response from DeepSeek');
    document.getElementById('coverLetterLoading').classList.add('hidden');
    document.getElementById('coverLetterResult').classList.remove('hidden');
    document.getElementById('coverLetterContent').textContent = coverLetterText;
  } catch (error) {
    document.getElementById('coverLetterLoading').classList.add('hidden');
    document.getElementById('coverLetterResult').classList.remove('hidden');
    document.getElementById('coverLetterContent').innerHTML =
      '<div class="bg-red-50 border border-red-200 rounded-lg p-6">' +
      '<p class="text-red-800 font-semibold mb-2">Error: Unable to generate cover letter</p>' +
      '<p class="text-red-600 text-sm">' + (error.message || 'Unknown error') + '</p>' +
      '<p class="text-gray-600 text-xs mt-2">Check DEEPSEEK_API_KEY in cv-editor.js and your balance.</p></div>';
  }
}

function copyCoverLetter() {
  const content = document.getElementById('coverLetterContent').textContent;
  navigator.clipboard.writeText(content).then(function () {
    alert('Cover letter copied to clipboard!');
  }).catch(function (err) {
    console.error('Failed to copy:', err);
    alert('Failed to copy. Please select and copy manually.');
  });
}

function downloadCoverLetter() {
  const content = document.getElementById('coverLetterContent').textContent;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const pos = document.getElementById('position');
  const company = document.getElementById('companyName');
  a.download = ((pos && pos.value) || 'Position') + '_' + ((company && company.value) || 'Company') + '_CoverLetter.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

addLang();
addEdu();
addExp();
