import { withSupabase } from 'npm:@supabase/server@1';

type Report = {
  title?: unknown;
  description?: unknown;
  context?: {
    screen?: unknown;
    recentScreens?: unknown;
    drink?: unknown;
    appVersion?: unknown;
    platform?: unknown;
  };
};

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership, error: membershipError } = await ctx.supabase
      .from('group_members').select('group_id').eq('user_id', userId).limit(1);
    if (membershipError) return Response.json({ error: 'Membership check failed' }, { status: 500 });
    if (!membership?.length) return Response.json({ error: 'Group membership required' }, { status: 403 });

    let report: Report;
    try { report = await request.json(); }
    catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
    if (!report || typeof report !== 'object') return Response.json({ error: 'Invalid report' }, { status: 400 });
    const title = text(report.title, 120);
    const description = text(report.description, 5000);
    if (!title || !description) return Response.json({ error: 'Title and description required' }, { status: 400 });

    const context = report.context && typeof report.context === 'object' ? report.context : {};
    const screens = Array.isArray(context.recentScreens)
      ? context.recentScreens.slice(-6).map((value) => text(value, 80)).filter(Boolean).join(' → ')
      : '';
    const body = [
      '## Beschreibung', description,
      '', '## App-Kontext',
      `- Aktuelle Ansicht: ${text(context.screen, 80) || 'Unbekannt'}`,
      `- Letzte Ansichten: ${screens || 'Unbekannt'}`,
      `- Cocktail im Bewertungsfenster: ${text(context.drink, 120) || 'Keiner'}`,
      `- App-Version: ${text(context.appVersion, 40) || 'Unbekannt'}`,
      `- Gerät/Browser: ${text(context.platform, 350) || 'Unbekannt'}`,
    ].join('\n');

    const token = Deno.env.get('GITHUB_ISSUES_TOKEN');
    if (!token) return Response.json({ error: 'Reporting not configured' }, { status: 503 });
    const response = await fetch('https://api.github.com/repos/schnitzltoast95/Cocktailrunde/issues', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Cocktailrunde-Bug-Reporter',
      },
      body: JSON.stringify({ title: `[App-Fehler] ${title}`, body, labels: ['bug'] }),
    });
    if (!response.ok) return Response.json({ error: 'GitHub issue creation failed' }, { status: 502 });
    const issue = await response.json();
    return Response.json({ url: issue.html_url });
  }),
};
