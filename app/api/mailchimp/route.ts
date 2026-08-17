import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import mailchimp from '@/lib/mailchimp';

const LIST = process.env.MAILCHIMP_AUDIENCE_ID!;

export async function POST(req: Request) {
  const { email, firstName, lastName, tags = [] } = await req.json();
  const hash = createHash('md5').update(email.toLowerCase()).digest('hex');

  try {
    // upsert: bestaat 'ie al, dan update i.p.v. 400
    await mailchimp.lists.setListMember(LIST, hash, {
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: { FNAME: firstName ?? '', LNAME: lastName ?? '' },
    });

    if (tags.length) {
      await mailchimp.lists.updateListMemberTags(LIST, hash, {
        tags: tags.map((name: string) => ({ name, status: 'active' })),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.response?.body?.detail ?? 'Mailchimp error' },
      { status: e.status ?? 500 }
    );
  }
}
