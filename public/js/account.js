// Account page: talks to the Better Auth API on auth.baderech.app with the shared
// .baderech.app session cookie (credentials: 'include'; the auth worker sends CORS).
// User-supplied text is only ever written with textContent.
;(() => {
  // Local dev talks to `pnpm dev` in BeezyWorksAccounts.
  const AUTH = location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : document.querySelector('meta[name="auth-base"]').content.replace(/\/$/, '')
  const HERE = location.origin + '/account/'
  const $ = (id) => document.getElementById(id)

  const FRIENDLY = {
    INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
    USER_ALREADY_EXISTS: 'There is already an account with that email. Try signing in, or reset your password.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'There is already an account with that email. Try signing in, or reset your password.',
    EMAIL_NOT_VERIFIED: "Please confirm your email first. We've sent you a fresh link.",
    PASSWORD_TOO_SHORT: 'Passwords need at least 8 characters.',
    INVALID_PASSWORD: "That password isn't right.",
    SESSION_EXPIRED: 'For your security, please sign out and sign in again, then try that again.',
    FAILED_TO_UNLINK_LAST_ACCOUNT: "You can't remove your only way to sign in.",
    TOKEN_EXPIRED: 'That link has expired. Sign in and we will send you a new one.',
    INVALID_TOKEN: "That link isn't valid anymore. Sign in and we'll send you a new one.",
    TOO_MANY_REQUESTS: 'Too many tries. Please wait a minute and try again.',
    account_already_linked_to_different_user: 'That account is already connected to a different Baderech account.',
    'email_doesn\'t_match': "That account's email doesn't match yours.",
    access_denied: 'Sign-in was cancelled.',
  }
  const friendly = (code, fallback) =>
    (code && FRIENDLY[code]) || fallback || 'Something went wrong. Please try again.'

  async function api(path, body) {
    let res
    try {
      res = await fetch(AUTH + '/api/auth' + path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new Error("Couldn't reach the account server. Check your connection and try again.")
    }
    let data = null
    try { data = await res.json() } catch {}
    if (!res.ok) {
      const code = res.status === 429 ? 'TOO_MANY_REQUESTS' : data && data.code
      const err = new Error(friendly(code, data && data.message))
      err.code = code
      throw err
    }
    return data
  }

  function say(el, text, kind) {
    el.textContent = text || ''
    el.className = 'msg' + (kind ? ' ' + kind : '')
    el.hidden = !text
  }

  /** Disable a form's buttons while a request runs. */
  async function busy(form, fn) {
    const buttons = form.querySelectorAll('button')
    buttons.forEach((b) => (b.disabled = true))
    try { await fn() } finally { buttons.forEach((b) => (b.disabled = false)) }
  }

  // ---------- query params from email links and social redirects ----------
  const params = new URLSearchParams(location.search)
  const banner = $('banner')
  if (params.get('error')) say(banner, friendly(params.get('error'), 'Sign-in didn\'t go through. Please try again.'), 'err')
  else if (params.has('verified')) say(banner, 'Baruch Hashem, your email is confirmed.', 'ok')
  if (params.toString()) history.replaceState(null, '', location.pathname)

  // ---------- signed out ----------
  const outMsg = $('out-msg')
  const panels = { signin: $('signin'), signup: $('signup'), forgot: $('forgot'), check: $('check-email') }
  let lastEmail = ''

  function show(which) {
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== which
    $('tab-in').setAttribute('aria-selected', String(which === 'signin' || which === 'forgot'))
    $('tab-up').setAttribute('aria-selected', String(which === 'signup'))
    const social = which === 'signin' || which === 'signup'
    $('socials').hidden = !social || !$('socials').dataset.any
    $('or').hidden = $('socials').hidden
    $('out-title').textContent = which === 'signup' ? 'Join us.' : which === 'check' ? 'Almost there.' : 'Baruch haba.'
    say(outMsg, '')
  }
  $('tab-in').onclick = () => show('signin')
  $('tab-up').onclick = () => show('signup')
  $('to-forgot').onclick = () => { $('fp-email').value = $('si-email').value; show('forgot') }
  $('back-signin').onclick = () => show('signin')

  async function sendVerification(email) {
    await api('/send-verification-email', { email, callbackURL: HERE + '?verified=1' })
  }

  panels.signin.onsubmit = (e) => {
    e.preventDefault()
    const email = $('si-email').value.trim()
    const password = $('si-pass').value
    if (!email || !password) return say(outMsg, 'Enter your email and password.', 'err')
    busy(panels.signin, async () => {
      try {
        await api('/sign-in/email', { email, password, rememberMe: true })
        $('si-pass').value = ''
        await load()
      } catch (err) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          lastEmail = email
          try { await sendVerification(email) } catch {}
          $('sent-to').textContent = email
          show('check')
          return
        }
        say(outMsg, err.message, 'err')
      }
    })
  }

  panels.signup.onsubmit = (e) => {
    e.preventDefault()
    const firstName = $('su-first').value.trim()
    const lastName = $('su-last').value.trim()
    const email = $('su-email').value.trim()
    const password = $('su-pass').value
    if (!firstName) return say(outMsg, 'Please enter your first name.', 'err')
    if (!email) return say(outMsg, 'Please enter your email.', 'err')
    if (password.length < 8) return say(outMsg, friendly('PASSWORD_TOO_SHORT'), 'err')
    busy(panels.signup, async () => {
      try {
        await api('/sign-up/email', {
          email, password, firstName, lastName: lastName || undefined,
          name: (firstName + ' ' + lastName).trim(),
          callbackURL: HERE + '?verified=1',
        })
        lastEmail = email
        $('su-pass').value = ''
        $('sent-to').textContent = email
        show('check')
      } catch (err) {
        say(outMsg, err.message, 'err')
      }
    })
  }

  panels.forgot.onsubmit = (e) => {
    e.preventDefault()
    const email = $('fp-email').value.trim()
    if (!email) return say(outMsg, 'Please enter your email.', 'err')
    busy(panels.forgot, async () => {
      try {
        await api('/request-password-reset', { email })
        say(outMsg, "If there's an account with that email, a reset link is on its way.", 'ok')
      } catch (err) {
        say(outMsg, err.message, 'err')
      }
    })
  }

  $('resend').onclick = async () => {
    if (!lastEmail) return
    try {
      await sendVerification(lastEmail)
      say(outMsg, 'Sent again. Give it a minute.', 'ok')
    } catch (err) {
      say(outMsg, err.message, 'err')
    }
  }

  async function social(provider, link) {
    const body = { provider, callbackURL: HERE, errorCallbackURL: HERE }
    const data = await api(link ? '/link-social' : '/sign-in/social', body)
    if (data && data.url) location.href = data.url
  }
  document.querySelectorAll('[data-social]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true
      try { await social(b.dataset.social, false) } catch (err) { say(outMsg, err.message, 'err'); b.disabled = false }
    }
  })

  // ---------- signed in ----------
  const inMsg = $('in-msg')
  let user = null
  let accounts = []
  let available = { google: false, apple: false }
  const hasPassword = () => accounts.some((a) => a.providerId === 'credential')

  const NAMES = { credential: 'Email & password', google: 'Google', apple: 'Apple' }

  function render() {
    const display = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email
    $('who-name').textContent = display
    $('who-email').textContent = user.email
    const v = $('who-verified')
    v.textContent = user.emailVerified ? 'Verified' : 'Not verified'
    v.className = 'badge ' + (user.emailVerified ? 'ok' : 'warn')
    $('avatar').textContent = (display.trim()[0] || '?').toUpperCase()
    $('pf-first').value = user.firstName || ''
    $('pf-last').value = user.lastName || ''
    $('pf-display').value = user.displayName || ''

    const list = $('conns')
    list.replaceChildren()
    const providers = ['credential', 'google', 'apple']
    for (const p of providers) {
      const acct = accounts.find((a) => a.providerId === p)
      if (!acct && p !== 'credential' && !available[p]) continue
      const li = document.createElement('li')
      const what = document.createElement('div')
      what.className = 'what'
      const t = document.createElement('span')
      t.textContent = NAMES[p]
      const s = document.createElement('span')
      s.textContent = acct ? 'Connected' : 'Not connected'
      what.append(t, s)
      li.append(what)
      if (p !== 'credential') {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'btn' + (acct ? ' danger' : '')
        b.textContent = acct ? 'Disconnect' : 'Connect'
        if (acct && accounts.length < 2) { b.disabled = true; b.title = "You can't remove your only way to sign in." }
        b.onclick = async () => {
          b.disabled = true
          try {
            if (acct) {
              await api('/unlink-account', { providerId: p, accountId: acct.accountId })
              say(inMsg, NAMES[p] + ' disconnected.', 'ok')
              await load()
            } else {
              await social(p, true)
            }
          } catch (err) {
            say(inMsg, err.message, 'err')
            b.disabled = false
          }
        }
        li.append(b)
      }
      list.append(li)
    }

    $('password').hidden = !hasPassword()
    $('pw-none').hidden = hasPassword()
    $('del-pass-field').hidden = !hasPassword()
  }

  $('profile').onsubmit = (e) => {
    e.preventDefault()
    busy($('profile'), async () => {
      try {
        await api('/update-user', {
          firstName: $('pf-first').value.trim() || null,
          lastName: $('pf-last').value.trim() || null,
          displayName: $('pf-display').value.trim() || null,
        })
        await load()
        say(inMsg, 'Saved.', 'ok')
      } catch (err) {
        say(inMsg, err.message, 'err')
      }
    })
  }

  $('password').onsubmit = (e) => {
    e.preventDefault()
    const currentPassword = $('pw-cur').value
    const newPassword = $('pw-new').value
    if (newPassword.length < 8) return say(inMsg, friendly('PASSWORD_TOO_SHORT'), 'err')
    if (newPassword !== $('pw-confirm').value) return say(inMsg, "The new passwords don't match.", 'err')
    busy($('password'), async () => {
      try {
        await api('/change-password', { currentPassword, newPassword, revokeOtherSessions: $('pw-revoke').checked })
        $('password').reset()
        $('pw-revoke').checked = true
        say(inMsg, 'Password changed.', 'ok')
      } catch (err) {
        say(inMsg, err.message, 'err')
      }
    })
  }

  $('pw-set').onclick = async () => {
    try {
      await api('/request-password-reset', { email: user.email })
      say(inMsg, 'Check your email for a link to set a password.', 'ok')
    } catch (err) {
      say(inMsg, err.message, 'err')
    }
  }

  $('signout').onclick = async () => {
    try { await api('/sign-out', {}) } catch {}
    user = null
    show('signin')
    await load()
  }

  $('del-confirm').oninput = () => {
    $('del-btn').disabled = $('del-confirm').value.trim().toLowerCase() !== 'delete'
  }
  $('delete').onsubmit = (e) => {
    e.preventDefault()
    if ($('del-confirm').value.trim().toLowerCase() !== 'delete') return
    const password = $('del-pass').value
    if (hasPassword() && !password) return say(inMsg, 'Enter your password to delete your account.', 'err')
    busy($('delete'), async () => {
      try {
        await api('/delete-user', hasPassword() ? { password } : {})
        user = null
        $('delete').reset()
        await load()
        show('signin')
        say(banner, 'Your account has been deleted. Zei gezunt, and you are always welcome back.', 'ok')
      } catch (err) {
        say(inMsg, err.message, 'err')
      }
      $('del-btn').disabled = true
    })
  }

  // ---------- boot ----------
  async function load() {
    let session = null
    try {
      session = await api('/get-session')
    } catch (err) {
      $('loading').textContent = err.message
      return
    }
    $('loading').hidden = true
    if (session && session.user) {
      user = session.user
      try { accounts = (await api('/list-accounts')) || [] } catch { accounts = [] }
      render()
      $('out').hidden = true
      $('in').hidden = false
    } else {
      $('in').hidden = true
      $('out').hidden = false
    }
  }

  async function loadProviders() {
    try {
      const res = await fetch(AUTH + '/providers', { credentials: 'include' })
      if (res.ok) available = await res.json()
    } catch {}
    let any = false
    document.querySelectorAll('[data-social]').forEach((b) => {
      b.hidden = !available[b.dataset.social]
      if (!b.hidden) any = true
    })
    $('socials').dataset.any = any ? '1' : ''
  }

  loadProviders().then(() => { show('signin'); return load() })
})()
