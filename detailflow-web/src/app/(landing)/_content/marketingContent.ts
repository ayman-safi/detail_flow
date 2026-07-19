import type { AppLocale } from '@/i18n/config';

export type MarketingLocale = AppLocale;

type PlanCopy = {
  name: string;
  price: string;
  cadence: string;
  note: string;
  features: string[];
  cta: string;
  featured?: boolean;
  comingSoon?: boolean;
};

export type LandingCopy = {
  meta: { title: string; description: string };
  nav: {
    product: string;
    workflow: string;
    experience: string;
    pricing: string;
    faq: string;
    signIn: string;
    start: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
    proof: string[];
    mediaLabel: string;
  };
  product: {
    eyebrow: string;
    title: string;
    body: string;
    tabs: string[];
    windowTitle: string;
    live: string;
    metrics: { active: string; staff: string; repeat: string };
    columns: string[];
    jobs: Array<{ vehicle: string; service: string; time: string }>;
    booking: {
      title: string;
      service: string;
      serviceValue: string;
      date: string;
      times: string[];
      confirm: string;
    };
    tracking: { title: string; vehicle: string; stages: string[]; message: string };
    photos: { title: string; before: string; after: string; note: string };
    analytics: { title: string; bookings: string; completed: string; returning: string; chart: string };
  };
  workflow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Array<{ number: string; title: string; body: string }>;
    nodes: string[];
  };
  experience: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
    trackerLabel: string;
    vehicle: string;
    service: string;
    stages: string[];
    currentStage: string;
    estimatedReady: string;
    estimatedTime: string;
    live: string;
    receipt: string;
    receiptNote: string;
    updateLabel: string;
    whatsapp: string;
  };
  photos: {
    eyebrow: string;
    title: string;
    body: string;
    demo: string;
    before: string;
    after: string;
    workOrder: string;
    assigned: string;
    ready: string;
    points: string[];
    compareHint: string;
  };
  pricing: {
    eyebrow: string;
    title: string;
    body: string;
    badge: string;
    plans: PlanCopy[];
  };
  faq: { eyebrow: string; title: string; items: Array<{ question: string; answer: string }> };
  final: { eyebrow: string; title: string; body: string; cta: string };
  footer: {
    tagline: string;
    product: string;
    access: string;
    contact: string;
    privacy: string;
    cookies: string;
    rights: string;
    manageCookies: string;
  };
  tour: {
    label: string;
    title: string;
    close: string;
    previous: string;
    next: string;
    finish: string;
    steps: Array<{ title: string; body: string }>;
  };
  consent: {
    title: string;
    body: string;
    accept: string;
    decline: string;
    preferences: string;
  };
  legal: {
    back: string;
    updated: string;
    privacyTitle: string;
    privacyIntro: string;
    privacySections: Array<{ title: string; body: string }>;
    cookiesTitle: string;
    cookiesIntro: string;
    cookiesSections: Array<{ title: string; body: string }>;
  };
};

const en: LandingCopy = {
  meta: {
    title: 'DetailFlow | Live shop operations for detailing and denting teams',
    description: 'Run bookings, vehicle stages, staff handoffs, customer tracking, photos, receipts and shop analytics from one live workspace.',
  },
  nav: {
    product: 'Live product', workflow: 'How it flows', experience: 'Customer experience', pricing: 'Pricing', faq: 'FAQ',
    signIn: 'Sign in', start: 'Start free', openMenu: 'Open navigation', closeMenu: 'Close navigation', language: 'Language',
  },
  hero: {
    eyebrow: 'The live operating system for detailing and denting shops',
    title: 'Every car. Every stage. One live shop.',
    body: 'Turn bookings, bay flow, staff handoffs and pickup updates into one clear operating rhythm your whole team can see.',
    primary: 'Start free — no card', secondary: 'Watch the 45-second tour',
    proof: ['Free plan', '30 bookings / month', 'Arabic · English · Turkish'],
    mediaLabel: 'Cinematic DetailFlow workshop and vehicle workflow',
  },
  product: {
    eyebrow: 'Live product proof',
    title: 'See the whole shop day before it becomes a bottleneck.',
    body: 'A realistic, interactive preview built from the workflows already running inside DetailFlow.',
    tabs: ['Live board', 'Booking', 'Tracking', 'Photos', 'Analytics'],
    windowTitle: 'Riyadh Shine · Live shop board', live: 'Live now',
    metrics: { active: 'Active cars', staff: 'Team on shift', repeat: 'Repeat customers' },
    columns: ['Booked', 'Arrived', 'In service', 'Ready'],
    jobs: [
      { vehicle: 'Mercedes S', service: 'Premium detail', time: '09:30' },
      { vehicle: 'Lexus ES', service: 'Interior polish', time: '11:30' },
      { vehicle: 'Range Rover', service: 'Full package', time: '13:00' },
      { vehicle: 'Audi Q8', service: 'Customer notified', time: '15:20' },
    ],
    booking: { title: 'Book a service', service: 'Service', serviceValue: 'Full polish · 220 SAR', date: 'Available today', times: ['10:00', '11:30', '13:00', '14:30'], confirm: 'Confirm booking' },
    tracking: { title: 'Private vehicle tracking', vehicle: 'Range Rover · Full package', stages: ['Booked', 'Arrived', 'Detailing', 'Ready'], message: 'Your vehicle is ready for pickup.' },
    photos: { title: 'Before & after record', before: 'Before', after: 'After', note: 'Photos stay attached to the work order and vehicle history.' },
    analytics: { title: 'Today at a glance', bookings: 'Bookings', completed: 'Completed', returning: 'Returning', chart: 'Jobs this week' },
  },
  workflow: {
    eyebrow: 'One connected flow', title: 'From the first WhatsApp message to vehicle pickup.',
    body: 'DetailFlow gives each handoff a visible place, so the shop stops depending on memory and scattered threads.',
    steps: [
      { number: '01', title: 'Capture demand cleanly', body: 'Share one booking link and collect the customer, vehicle, service and time without message-by-message admin.' },
      { number: '02', title: 'Move every vehicle visibly', body: 'The team advances work through clear stages while assignments, photos and ready times stay attached.' },
      { number: '03', title: 'Close the loop automatically', body: 'Customers follow a private status link, receive pickup updates and access their receipt without calling the desk.' },
    ],
    nodes: ['New booking', 'Vehicle arrives', 'Assign staff', 'Before photos', 'Live stages', 'WhatsApp update', 'Receipt PDF'],
  },
  experience: {
    eyebrow: 'Built for customer confidence', title: 'Keep every customer informed from drop-off to pickup.',
    body: 'Give customers a private link to follow their vehicle, check the expected ready time and know exactly when it is ready—without downloading an app.',
    points: ['Private live progress for every work order', 'An expected ready time customers can check anytime', 'WhatsApp updates when the vehicle status changes', 'Receipt access from the same secure link'],
    trackerLabel: 'Private customer tracking', vehicle: 'Porsche 911', service: 'Full Detail', stages: ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready'], currentStage: 'Current stage', estimatedReady: 'Estimated ready by:', estimatedTime: '2:23 PM', live: 'Live status', receipt: 'Receipt access', receiptNote: 'Available from this same private link after delivery.', updateLabel: 'WhatsApp update', whatsapp: 'Your vehicle is ready for pickup.',
  },
  photos: {
    eyebrow: 'Vehicle history with evidence', title: 'The work is visible before the keys change hands.',
    body: 'Capture condition at arrival, document the finish and keep the full story attached to the vehicle—not buried in a team chat.',
    demo: 'Demo work order', before: 'Arrival', after: 'Ready for pickup', workOrder: 'DF-2048 · Range Rover', assigned: 'Assigned to Kareem', ready: 'Ready · 4:20 PM',
    points: ['Capture arrival condition from any phone', 'Keep photos attached to the work order', 'Compare the finish at customer handoff', 'Retain the visual record with the vehicle'],
    compareHint: 'Drag to compare arrival and ready-for-pickup photos',
  },
  pricing: {
    eyebrow: 'Simple Saudi pricing', title: 'Start with the board. Upgrade when the shop needs automation.',
    body: 'No annual toggle, no hidden launch claims and no card required for the Free workspace.', badge: 'Best fit',
    plans: [
      { name: 'Free', price: '0 SAR', cadence: 'forever', note: 'For proving the flow with your team.', features: ['30 bookings per month', 'Public booking page', 'Live operations board', 'Customer tracking', '2 team users · 3 photos per work order'], cta: 'Start free' },
      { name: 'Pro', price: '149 SAR', cadence: 'per month', note: 'For shops running daily bookings and pickup automation.', features: ['Unlimited bookings', '500 WhatsApp messages included', 'Analytics and reports', '10 team accounts', '10 photos per work order'], cta: 'Start Pro', featured: true },
      { name: 'Business', price: 'Coming soon', cadence: '', note: 'For future multi-location operations.', features: ['Everything in Pro', 'Unlimited team accounts', 'Multi-location support is not yet available', 'Priority launch access'], cta: 'Coming soon', comingSoon: true },
    ],
  },
  faq: {
    eyebrow: 'Clear before you start', title: 'The questions shop owners ask first.',
    items: [
      { question: 'Do I need a payment card to register?', answer: 'No. Create a workspace and start on Free immediately. Upgrade only when you need Pro limits and automation.' },
      { question: 'Does DetailFlow replace our current WhatsApp?', answer: 'Your team can share booking, tracking and receipt links through WhatsApp. Pro can also send automatic Meta WhatsApp Business notifications.' },
      { question: 'What does the customer see?', answer: 'A private page showing the vehicle, service, current stage, estimated ready time and receipt access after delivery.' },
      { question: 'Can staff use it from a phone?', answer: 'Yes. Booking, tracking and the operational board are responsive and support full Arabic RTL.' },
      { question: 'Can I manage multiple branches?', answer: 'Not yet. DetailFlow currently supports one shop location per workspace; multi-location support remains a future Business capability.' },
    ],
  },
  final: { eyebrow: 'Start with the next vehicle', title: 'Give every car a clear path through the shop.', body: 'Create your DetailFlow workspace, share the booking link and run the next handoff from one live board.', cta: 'Start free now' },
  footer: { tagline: 'Live operations for detailing and denting shops.', product: 'Product', access: 'Access', contact: 'Contact', privacy: 'Privacy', cookies: 'Cookies', rights: '© 2026 DetailFlow. All rights reserved.', manageCookies: 'Manage cookies' },
  tour: {
    label: '45-second product tour', title: 'One shop day, four clear moments.', close: 'Close tour', previous: 'Previous', next: 'Next', finish: 'Start free',
    steps: [
      { title: 'A booking lands cleanly', body: 'Customer, vehicle, service and time enter the schedule together.' },
      { title: 'The board becomes the source of truth', body: 'Every vehicle advances through visible stages with a clear owner.' },
      { title: 'Customers stay informed', body: 'A private link and WhatsApp-ready updates reduce repeated calls.' },
      { title: 'The owner sees the pattern', body: 'Bookings, completed work, popular services and repeat customers become measurable.' },
    ],
  },
  consent: { title: 'Useful analytics, only with your permission.', body: 'We use consent-gated PostHog events to understand which product stories lead to registration. No session replay and no form values.', accept: 'Allow analytics', decline: 'Only necessary', preferences: 'Analytics preferences' },
  legal: {
    back: 'Back to DetailFlow', updated: 'Updated July 2026',
    privacyTitle: 'Privacy', privacyIntro: 'This launch privacy notice explains the limited data used by the DetailFlow marketing experience.',
    privacySections: [
      { title: 'Account information', body: 'When you register, DetailFlow processes the shop and owner information required to create and secure the workspace.' },
      { title: 'Optional analytics', body: 'With explicit consent, the site records page and funnel events such as CTA location, locale and completed registration. It does not send form values to analytics.' },
      { title: 'Your choices', body: 'You can decline analytics or change the preference from the footer at any time. Necessary authentication and locale storage continue to function.' },
    ],
    cookiesTitle: 'Cookie preferences', cookiesIntro: 'DetailFlow separates required storage from optional marketing analytics.',
    cookiesSections: [
      { title: 'Necessary storage', body: 'Locale, authentication and security storage are used to deliver the requested service and cannot be disabled from the analytics control.' },
      { title: 'Analytics storage', body: 'PostHog initializes only after you choose Allow analytics. Session replay and automatic interaction capture are disabled.' },
      { title: 'Change your preference', body: 'Use Manage cookies in the footer to reopen the consent control. Declining removes the local analytics preference and stops new analytics events.' },
    ],
  },
};

const ar: LandingCopy = {
  ...en,
  meta: { title: 'DetailFlow | تشغيل مباشر لورش التلميع والسمكرة', description: 'أدر الحجوزات ومراحل المركبات وتسليمات الفريق وتتبع العملاء والصور والإيصالات وتحليلات الورشة من مساحة عمل مباشرة واحدة.' },
  nav: { product: 'المنتج مباشرة', workflow: 'كيف يعمل', experience: 'تجربة العميل', pricing: 'الأسعار', faq: 'الأسئلة', signIn: 'تسجيل الدخول', start: 'ابدأ مجانًا', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', language: 'اللغة' },
  hero: { eyebrow: 'نظام التشغيل المباشر لورش التلميع والسمكرة', title: 'كل سيارة. كل مرحلة. ورشة واحدة مباشرة.', body: 'حوّل الحجوزات وحركة المسارات وتسليمات الفريق وتحديثات الاستلام إلى إيقاع تشغيلي واضح يراه الجميع.', primary: 'ابدأ مجانًا — بدون بطاقة', secondary: 'شاهد الجولة في 45 ثانية', proof: ['خطة مجانية', '30 حجزًا شهريًا', 'العربية · الإنجليزية · التركية'], mediaLabel: 'مشهد سينمائي لورشة DetailFlow ومسار المركبة' },
  product: {
    ...en.product,
    eyebrow: 'دليل حي من المنتج', title: 'شاهد يوم الورشة كاملًا قبل أن يتحول إلى اختناق.', body: 'معاينة تفاعلية واقعية مبنية على مسارات العمل الموجودة فعليًا داخل DetailFlow.',
    tabs: ['لوحة التشغيل', 'الحجز', 'التتبع', 'الصور', 'التحليلات'], windowTitle: 'لمعة الرياض · لوحة الورشة', live: 'مباشر الآن',
    metrics: { active: 'سيارات نشطة', staff: 'الفريق في الوردية', repeat: 'عملاء متكررون' }, columns: ['محجوز', 'وصل', 'قيد الخدمة', 'جاهز'],
    jobs: [
      { vehicle: 'مرسيدس S', service: 'تلميع فاخر', time: '09:30' }, { vehicle: 'لكزس ES', service: 'تلميع داخلي', time: '11:30' },
      { vehicle: 'رنج روفر', service: 'باقة كاملة', time: '13:00' }, { vehicle: 'أودي Q8', service: 'تم إشعار العميل', time: '15:20' },
    ],
    booking: { title: 'احجز خدمة', service: 'الخدمة', serviceValue: 'تلميع كامل · 220 ريال', date: 'متاح اليوم', times: ['10:00', '11:30', '13:00', '14:30'], confirm: 'تأكيد الحجز' },
    tracking: { title: 'تتبع خاص للمركبة', vehicle: 'رنج روفر · باقة كاملة', stages: ['محجوز', 'وصل', 'تلميع', 'جاهز'], message: 'سيارتك جاهزة للاستلام.' },
    photos: { title: 'سجل قبل وبعد', before: 'قبل', after: 'بعد', note: 'تبقى الصور مرتبطة بأمر العمل وسجل المركبة.' },
    analytics: { title: 'اليوم في نظرة', bookings: 'الحجوزات', completed: 'المكتمل', returning: 'المتكرر', chart: 'أعمال هذا الأسبوع' },
  },
  workflow: { eyebrow: 'مسار واحد متصل', title: 'من أول رسالة واتساب إلى استلام المركبة.', body: 'يمنح DetailFlow كل تسليم مكانًا واضحًا، فلا تعتمد الورشة على الذاكرة والرسائل المتفرقة.', steps: [
    { number: '01', title: 'استقبل الطلب بشكل منظم', body: 'شارك رابط حجز واحد واجمع العميل والمركبة والخدمة والوقت بدون إدارة كل رسالة على حدة.' },
    { number: '02', title: 'حرّك كل مركبة بوضوح', body: 'ينقل الفريق العمل عبر مراحل واضحة مع بقاء المسؤول والصور ووقت الجاهزية في مكان واحد.' },
    { number: '03', title: 'أغلق الحلقة تلقائيًا', body: 'يتابع العميل رابطًا خاصًا ويتلقى تحديث الاستلام ويصل إلى الإيصال دون الاتصال بالاستقبال.' },
  ], nodes: ['حجز جديد', 'وصول المركبة', 'إسناد الموظف', 'صور قبل العمل', 'مراحل مباشرة', 'تحديث واتساب', 'إيصال PDF'] },
  experience: { eyebrow: 'تجربة عميل تليق بورشتك', title: 'طمّن عميلك على مركبته من الاستلام إلى التسليم.', body: 'امنح كل عميل رابطًا خاصًا يتابع منه حالة مركبته وموعد جاهزيتها، ويعرف فورًا متى يحين وقت الاستلام — دون تحميل أي تطبيق.', points: ['متابعة خاصة وواضحة لكل أمر عمل', 'وقت جاهزية متوقع يمكن الرجوع إليه في أي وقت', 'تحديث عبر واتساب عند تغيّر حالة المركبة', 'الإيصال متاح من نفس الرابط بعد التسليم'], trackerLabel: 'تتبع خاص للعميل', vehicle: 'Porsche 911', service: 'Full Detail', stages: ['محجوز', 'وصل', 'غسيل', 'تجهيز', 'تلميع', 'جاهز'], currentStage: 'المرحلة الحالية', estimatedReady: 'الوقت المتوقع للجاهزية:', estimatedTime: '2:23 م', live: 'حالة مباشرة', receipt: 'الوصول إلى الإيصال', receiptNote: 'يتوفر من نفس الرابط الخاص بعد تسليم المركبة.', updateLabel: 'تحديث واتساب', whatsapp: 'مركبتك جاهزة للاستلام.' },
  photos: { eyebrow: 'سجل مركبة مدعوم بالدليل', title: 'العمل واضح قبل أن تنتقل المفاتيح.', body: 'وثّق حالة الوصول والنتيجة النهائية واحتفظ بالقصة كاملة مع المركبة بدلًا من دفنها في محادثة الفريق.', demo: 'أمر عمل تجريبي', before: 'عند الوصول', after: 'جاهزة للاستلام', workOrder: 'DF-2048 · رنج روفر', assigned: 'مُسند إلى كريم', ready: 'جاهزة · 4:20 م', points: ['وثّق حالة الوصول من أي جوال', 'احتفظ بالصور مع أمر العمل', 'قارن النتيجة عند تسليم المركبة', 'أبقِ السجل المرئي مرتبطًا بالمركبة'], compareHint: 'اسحب للمقارنة بين صور الوصول والجاهزية للاستلام' },
  pricing: { eyebrow: 'أسعار سعودية واضحة', title: 'ابدأ باللوحة. وطوّر عندما تحتاج الورشة إلى الأتمتة.', body: 'بدون تبديل سنوي أو وعود مخفية أو بطاقة مطلوبة لمساحة Free.', badge: 'الأنسب', plans: [
    { name: 'Free', price: '0 ريال', cadence: 'دائمًا', note: 'لتجربة المسار مع فريقك.', features: ['30 حجزًا شهريًا', 'صفحة حجز عامة', 'لوحة تشغيل مباشرة', 'تتبع العميل', 'مستخدمان · 3 صور لكل أمر عمل'], cta: 'ابدأ مجانًا' },
    { name: 'Pro', price: '149 ريال', cadence: 'شهريًا', note: 'للورش التي تدير الحجوزات والأتمتة يوميًا.', features: ['حجوزات غير محدودة', '500 رسالة واتساب', 'تحليلات وتقارير', '10 حسابات فريق', '10 صور لكل أمر عمل'], cta: 'ابدأ Pro', featured: true },
    { name: 'Business', price: 'قريبًا', cadence: '', note: 'للتشغيل متعدد المواقع مستقبلًا.', features: ['كل ما في Pro', 'حسابات فريق غير محدودة', 'دعم المواقع المتعددة غير متاح بعد', 'أولوية عند الإطلاق'], cta: 'قريبًا', comingSoon: true },
  ] },
  faq: { eyebrow: 'وضوح قبل البداية', title: 'الأسئلة التي يطرحها أصحاب الورش أولًا.', items: [
    { question: 'هل أحتاج بطاقة دفع للتسجيل؟', answer: 'لا. أنشئ مساحة عمل وابدأ بخطة Free مباشرة، ثم طوّر فقط عند حاجتك إلى حدود Pro والأتمتة.' },
    { question: 'هل يستبدل DetailFlow واتساب الحالي؟', answer: 'يستطيع الفريق مشاركة روابط الحجز والتتبع والإيصال عبر واتساب، وتستطيع Pro إرسال إشعارات Meta WhatsApp Business تلقائيًا.' },
    { question: 'ماذا يرى العميل؟', answer: 'صفحة خاصة تعرض المركبة والخدمة والمرحلة الحالية والوقت المتوقع للجاهزية والوصول إلى الإيصال بعد التسليم.' },
    { question: 'هل يستطيع الموظفون استخدامه من الجوال؟', answer: 'نعم. الحجز والتتبع ولوحة التشغيل متجاوبة وتدعم العربية RTL بالكامل.' },
    { question: 'هل يمكنني إدارة عدة فروع؟', answer: 'ليس بعد. يدعم DetailFlow حاليًا موقع ورشة واحدًا لكل مساحة عمل، وتبقى المواقع المتعددة ميزة مستقبلية لخطة Business.' },
  ] },
  final: { eyebrow: 'ابدأ بالمركبة القادمة', title: 'امنح كل سيارة مسارًا واضحًا داخل الورشة.', body: 'أنشئ مساحة DetailFlow، وشارك رابط الحجز، وأدر التسليم القادم من لوحة واحدة مباشرة.', cta: 'ابدأ مجانًا الآن' },
  footer: { tagline: 'تشغيل مباشر لورش التلميع والسمكرة.', product: 'المنتج', access: 'الدخول', contact: 'التواصل', privacy: 'الخصوصية', cookies: 'ملفات الارتباط', rights: '© 2026 DetailFlow. جميع الحقوق محفوظة.', manageCookies: 'إدارة ملفات الارتباط' },
  tour: { label: 'جولة في 45 ثانية', title: 'يوم ورشة واحد، أربع لحظات واضحة.', close: 'إغلاق الجولة', previous: 'السابق', next: 'التالي', finish: 'ابدأ مجانًا', steps: [
    { title: 'يصل الحجز كاملًا', body: 'يدخل العميل والمركبة والخدمة والوقت إلى الجدول معًا.' }, { title: 'تصبح اللوحة مصدر الحقيقة', body: 'تتحرك كل مركبة عبر مراحل مرئية مع مسؤول واضح.' },
    { title: 'يبقى العميل مطلعًا', body: 'يقلل الرابط الخاص وتحديثات واتساب الاتصالات المتكررة.' }, { title: 'يرى المالك النمط', body: 'تصبح الحجوزات والأعمال المكتملة والخدمات والعملاء المتكررون قابلة للقياس.' },
  ] },
  consent: { title: 'تحليلات مفيدة، بموافقتك فقط.', body: 'نستخدم أحداث PostHog بعد الموافقة لفهم القصص التي تقود للتسجيل. بدون تسجيل جلسات أو قيم النماذج.', accept: 'السماح بالتحليلات', decline: 'الضروري فقط', preferences: 'تفضيلات التحليلات' },
  legal: { back: 'العودة إلى DetailFlow', updated: 'آخر تحديث يوليو 2026', privacyTitle: 'الخصوصية', privacyIntro: 'يوضح هذا الإشعار المختصر البيانات المحدودة المستخدمة في تجربة DetailFlow التسويقية.', privacySections: [
    { title: 'بيانات الحساب', body: 'عند التسجيل، يعالج DetailFlow بيانات الورشة والمالك اللازمة لإنشاء مساحة العمل وتأمينها.' }, { title: 'التحليلات الاختيارية', body: 'بعد موافقة صريحة، يسجل الموقع أحداث الصفحة والمسار مثل موضع الزر واللغة واكتمال التسجيل، دون إرسال قيم النماذج.' }, { title: 'خياراتك', body: 'يمكنك رفض التحليلات أو تغيير اختيارك من التذييل في أي وقت، بينما يستمر التخزين الضروري للمصادقة واللغة.' },
  ], cookiesTitle: 'تفضيلات ملفات الارتباط', cookiesIntro: 'يفصل DetailFlow بين التخزين الضروري والتحليلات التسويقية الاختيارية.', cookiesSections: [
    { title: 'التخزين الضروري', body: 'تُستخدم إعدادات اللغة والمصادقة والأمان لتقديم الخدمة ولا يعطلها خيار التحليلات.' }, { title: 'تخزين التحليلات', body: 'يبدأ PostHog فقط بعد اختيار السماح بالتحليلات، مع تعطيل تسجيل الجلسات والتقاط التفاعلات التلقائي.' }, { title: 'تغيير الاختيار', body: 'استخدم إدارة ملفات الارتباط في التذييل لإعادة فتح التحكم. يوقف الرفض أحداث التحليلات الجديدة.' },
  ] },
};

const tr: LandingCopy = {
  ...en,
  meta: { title: 'DetailFlow | Detay ve kaporta ekipleri için canlı işletme akışı', description: 'Randevuları, araç aşamalarını, ekip devirlerini, müşteri takibini, fotoğrafları, fişleri ve analizleri tek canlı çalışma alanından yönetin.' },
  nav: { product: 'Canlı ürün', workflow: 'Nasıl işler', experience: 'Müşteri deneyimi', pricing: 'Fiyatlar', faq: 'SSS', signIn: 'Giriş yap', start: 'Ücretsiz başla', openMenu: 'Menüyü aç', closeMenu: 'Menüyü kapat', language: 'Dil' },
  hero: { eyebrow: 'Detay ve kaporta işletmeleri için canlı operasyon sistemi', title: 'Her araç. Her aşama. Tek canlı işletme.', body: 'Randevuları, iş akışını, ekip devirlerini ve teslimat güncellemelerini herkesin görebildiği net bir ritme dönüştürün.', primary: 'Ücretsiz başla — kart yok', secondary: '45 saniyelik turu izle', proof: ['Ücretsiz plan', 'Ayda 30 randevu', 'Arapça · İngilizce · Türkçe'], mediaLabel: 'Sinematik DetailFlow atölyesi ve araç akışı' },
  product: { ...en.product, eyebrow: 'Canlı ürün kanıtı', title: 'İşletme gününü darboğaz olmadan önce görün.', body: 'DetailFlow içinde çalışan gerçek akışlardan oluşturulmuş etkileşimli bir önizleme.', tabs: ['Canlı pano', 'Randevu', 'Takip', 'Fotoğraflar', 'Analiz'], windowTitle: 'Riyadh Shine · Canlı pano', live: 'Şimdi canlı', metrics: { active: 'Aktif araç', staff: 'Vardiyadaki ekip', repeat: 'Tekrar gelen müşteri' }, columns: ['Randevulu', 'Geldi', 'İşlemde', 'Hazır'],
    booking: { title: 'Hizmet randevusu', service: 'Hizmet', serviceValue: 'Tam cila · 220 SAR', date: 'Bugün uygun', times: ['10:00', '11:30', '13:00', '14:30'], confirm: 'Randevuyu onayla' },
    tracking: { title: 'Özel araç takibi', vehicle: 'Range Rover · Tam paket', stages: ['Randevulu', 'Geldi', 'Detay', 'Hazır'], message: 'Aracınız teslim alınmaya hazır.' },
    photos: { title: 'Önce ve sonra kaydı', before: 'Önce', after: 'Sonra', note: 'Fotoğraflar iş emrine ve araç geçmişine bağlı kalır.' },
    analytics: { title: 'Bugüne tek bakış', bookings: 'Randevu', completed: 'Tamamlanan', returning: 'Tekrar gelen', chart: 'Bu haftaki işler' },
  },
  workflow: { eyebrow: 'Tek bağlı akış', title: 'İlk WhatsApp mesajından araç teslimine.', body: 'DetailFlow her devri görünür kılar; işletme hafızaya ve dağınık mesajlara bağımlı kalmaz.', steps: [
    { number: '01', title: 'Talebi düzenli alın', body: 'Tek randevu bağlantısıyla müşteri, araç, hizmet ve saat bilgisini mesaj trafiği olmadan toplayın.' },
    { number: '02', title: 'Her aracı görünür ilerletin', body: 'Ekip araçları net aşamalardan geçirirken sorumlu kişi, fotoğraflar ve hazır zamanı birlikte kalır.' },
    { number: '03', title: 'Müşteri döngüsünü kapatın', body: 'Müşteri özel bağlantıdan durumu izler, teslimat mesajını alır ve fişe masayı aramadan ulaşır.' },
  ], nodes: ['Yeni randevu', 'Araç geldi', 'Personel ata', 'Önce fotoğrafları', 'Canlı aşamalar', 'WhatsApp güncellemesi', 'PDF fiş'] },
  experience: { eyebrow: 'Müşteriye güven veren deneyim', title: 'Müşteriniz aracının durumunu teslimata kadar anlık takip etsin.', body: 'Her müşteriye aracın durumunu ve tahmini teslim saatini gösteren özel bir bağlantı verin; araç hazır olduğunda WhatsApp üzerinden haber verin — uygulama indirmeden.', points: ['Her iş emri için müşteriye özel takip bağlantısı', 'Her an görülebilen tahmini teslim saati', 'Durum değiştiğinde WhatsApp bilgilendirmesi', 'Teslimden sonra aynı bağlantıdan fiş erişimi'], trackerLabel: 'Özel müşteri takibi', vehicle: 'Porsche 911', service: 'Full Detail', stages: ['Rezerve', 'Geldi', 'Yıkama', 'Detay', 'Parlatma', 'Hazır'], currentStage: 'Mevcut aşama', estimatedReady: 'Tahmini hazır olma:', estimatedTime: '14:23', live: 'Canlı durum', receipt: 'Fiş erişimi', receiptNote: 'Teslimden sonra aynı özel bağlantıdan açılır.', updateLabel: 'WhatsApp güncellemesi', whatsapp: 'Aracınız teslimata hazır.' },
  photos: { eyebrow: 'Kanıtlı araç geçmişi', title: 'Anahtar tesliminden önce yapılan iş görünür.', body: 'Giriş durumunu ve bitmiş sonucu belgeleyin; bütün hikâyeyi ekip sohbetinde değil araçla birlikte saklayın.', demo: 'Demo iş emri', before: 'Giriş', after: 'Teslime hazır', workOrder: 'DF-2048 · Range Rover', assigned: 'Kareem’e atandı', ready: 'Hazır · 16:20', points: ['Giriş durumunu herhangi bir telefondan çekin', 'Fotoğrafları iş emrine bağlı tutun', 'Müşteri tesliminde sonucu karşılaştırın', 'Görsel kaydı araçla birlikte saklayın'], compareHint: 'Giriş ve teslim fotoğraflarını karşılaştırmak için sürükleyin' },
  pricing: { eyebrow: 'Net Suudi fiyatlandırma', title: 'Panoyla başlayın. Otomasyon gerektiğinde yükseltin.', body: 'Yıllık geçiş, gizli vaat veya Free çalışma alanı için kart zorunluluğu yok.', badge: 'En uygun', plans: [
    { name: 'Free', price: '0 SAR', cadence: 'süresiz', note: 'Akışı ekibinizle denemek için.', features: ['Ayda 30 randevu', 'Herkese açık randevu sayfası', 'Canlı operasyon panosu', 'Müşteri takibi', '2 ekip kullanıcısı · iş emri başına 3 fotoğraf'], cta: 'Ücretsiz başla' },
    { name: 'Pro', price: '149 SAR', cadence: 'aylık', note: 'Günlük randevu ve teslim otomasyonu için.', features: ['Sınırsız randevu', '500 WhatsApp mesajı', 'Analiz ve raporlar', '10 ekip hesabı', 'İş emri başına 10 fotoğraf'], cta: 'Pro’ya başla', featured: true },
    { name: 'Business', price: 'Yakında', cadence: '', note: 'Gelecekte çoklu konum operasyonları için.', features: ['Pro’daki her şey', 'Sınırsız ekip hesabı', 'Çoklu konum henüz kullanılamıyor', 'Öncelikli lansman erişimi'], cta: 'Yakında', comingSoon: true },
  ] },
  faq: { eyebrow: 'Başlamadan önce netlik', title: 'İşletme sahiplerinin ilk sorduğu sorular.', items: [
    { question: 'Kayıt için ödeme kartı gerekir mi?', answer: 'Hayır. Çalışma alanını oluşturup hemen Free ile başlayın; yalnızca Pro limitleri ve otomasyon gerektiğinde yükseltin.' },
    { question: 'DetailFlow mevcut WhatsApp’ımızın yerini alır mı?', answer: 'Ekip randevu, takip ve fiş bağlantılarını WhatsApp üzerinden paylaşabilir. Pro ayrıca otomatik Meta WhatsApp Business bildirimleri gönderebilir.' },
    { question: 'Müşteri ne görür?', answer: 'Araç, hizmet, mevcut aşama, tahmini hazır zamanı ve teslim sonrası fiş erişimini gösteren özel bir sayfa.' },
    { question: 'Personel telefondan kullanabilir mi?', answer: 'Evet. Randevu, takip ve operasyon panosu responsive çalışır ve tam Arapça RTL desteğine sahiptir.' },
    { question: 'Birden fazla şubeyi yönetebilir miyim?', answer: 'Henüz değil. DetailFlow şu anda çalışma alanı başına tek konumu destekler; çoklu konum gelecekteki Business özelliğidir.' },
  ] },
  final: { eyebrow: 'Sonraki araçla başlayın', title: 'Her araca işletmede net bir yol verin.', body: 'DetailFlow çalışma alanını oluşturun, randevu bağlantısını paylaşın ve sonraki devri tek canlı panodan yönetin.', cta: 'Şimdi ücretsiz başla' },
  footer: { tagline: 'Detay ve kaporta işletmeleri için canlı operasyon.', product: 'Ürün', access: 'Erişim', contact: 'İletişim', privacy: 'Gizlilik', cookies: 'Çerezler', rights: '© 2026 DetailFlow. Tüm hakları saklıdır.', manageCookies: 'Çerezleri yönet' },
  tour: { label: '45 saniyelik ürün turu', title: 'Bir işletme günü, dört net an.', close: 'Turu kapat', previous: 'Önceki', next: 'Sonraki', finish: 'Ücretsiz başla', steps: [
    { title: 'Randevu düzenli gelir', body: 'Müşteri, araç, hizmet ve saat programa birlikte girer.' }, { title: 'Pano tek gerçek olur', body: 'Her araç net bir sorumluyla görünür aşamalardan geçer.' },
    { title: 'Müşteri bilgi sahibi kalır', body: 'Özel bağlantı ve WhatsApp güncellemeleri tekrar aramaları azaltır.' }, { title: 'İşletme sahibi deseni görür', body: 'Randevu, tamamlanan iş, popüler hizmet ve tekrar gelen müşteri ölçülebilir olur.' },
  ] },
  consent: { title: 'Yararlı analiz, yalnızca izninizle.', body: 'Hangi ürün anlatımlarının kayda götürdüğünü anlamak için izinli PostHog olayları kullanırız. Oturum kaydı ve form değerleri yoktur.', accept: 'Analize izin ver', decline: 'Yalnızca gerekli', preferences: 'Analiz tercihleri' },
  legal: { back: 'DetailFlow’a dön', updated: 'Temmuz 2026’da güncellendi', privacyTitle: 'Gizlilik', privacyIntro: 'Bu kısa bildirim DetailFlow pazarlama deneyiminde kullanılan sınırlı verileri açıklar.', privacySections: [
    { title: 'Hesap bilgileri', body: 'Kayıt sırasında DetailFlow, çalışma alanını oluşturmak ve güvenceye almak için gereken işletme ve sahip bilgilerini işler.' }, { title: 'İsteğe bağlı analiz', body: 'Açık izinle site CTA konumu, dil ve tamamlanan kayıt gibi sayfa ve huni olaylarını kaydeder; form değerlerini analize göndermez.' }, { title: 'Seçimleriniz', body: 'Analizi reddedebilir veya tercihi altbilgiden değiştirebilirsiniz. Gerekli kimlik ve dil depolaması çalışmaya devam eder.' },
  ], cookiesTitle: 'Çerez tercihleri', cookiesIntro: 'DetailFlow gerekli depolamayı isteğe bağlı pazarlama analizinden ayırır.', cookiesSections: [
    { title: 'Gerekli depolama', body: 'Dil, kimlik doğrulama ve güvenlik depolaması istenen hizmeti sunar ve analiz kontrolünden kapatılamaz.' }, { title: 'Analiz depolaması', body: 'PostHog yalnızca Analize izin ver seçildikten sonra başlar. Oturum kaydı ve otomatik etkileşim yakalama kapalıdır.' }, { title: 'Tercihi değiştirme', body: 'Kontrolü yeniden açmak için altbilgide Çerezleri yönet bağlantısını kullanın. Reddetmek yeni analiz olaylarını durdurur.' },
  ] },
};

export const marketingContent: Record<MarketingLocale, LandingCopy> = { en, ar, tr };

export function isMarketingLocale(value: string): value is MarketingLocale {
  return value === 'en' || value === 'ar' || value === 'tr';
}
