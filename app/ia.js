(() => {
  const output = document.querySelector('#l3')
  const panel = document.createElement('section')
  panel.className = 'l3sec'
  panel.innerHTML = `
    <h3>Assistente da simulação</h3>
    <form>
      <label>Modelo <select name="modo"><option value="gemma">Gemma 4B · conversa</option><option value="medgemma">MedGemma 4B · resumo por texto</option></select></label>
      <p><label>Mensagem <textarea name="pergunta" rows="3" maxlength="1600" required placeholder="O que aconteceu neste cenário?" style="display:block;width:100%"></textarea></label></p>
      <button class="btn" type="submit">Enviar</button>
      <button class="btn" type="button" data-action="mic">Falar pergunta</button>
      <button class="btn" type="button" data-action="stop">Parar voz</button>
      <label><input type="checkbox" name="ler" checked> Ler respostas completas</label>
    </form>
    <p role="status"></p>
    <div aria-live="polite" style="white-space:pre-wrap;max-height:28rem;overflow:auto"></div>`
  output.after(panel)
  const form = panel.querySelector('form')
  const status = panel.querySelector('[role=status]')
  const log = panel.querySelector('[aria-live]')
  const mic = panel.querySelector('[data-action=mic]')
  const submit = form.querySelector('[type=submit]')
  let history = [], controller, playback, recognition
  function stop() {
    controller?.abort()
    playback?.pause()
    window.speechSynthesis?.cancel()
  }
  panel.querySelector('[data-action=stop]').onclick = stop
  form.elements.ler.onchange = () => { if (!form.elements.ler.checked) stop() }
  async function speak(text) {
    stop()
    const request = new AbortController()
    controller = request
    let objectUrl
    try {
      const response = await fetch('/api/voz', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({texto:text}), signal:request.signal})
      if (!response.ok) throw Error()
      objectUrl = URL.createObjectURL(await response.blob())
      if (request.signal.aborted) { URL.revokeObjectURL(objectUrl); return }
      playback = new Audio(objectUrl)
      const release = () => URL.revokeObjectURL(objectUrl)
      playback.onended = playback.onpause = release
      await playback.play()
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (request.signal.aborted) return
      if (!window.speechSynthesis) {status.textContent = 'Voz indisponível.'; return}
      status.textContent = 'Usando a voz do navegador.'
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      speechSynthesis.speak(utterance)
    }
  }
  mic.onclick = () => {
    if (recognition) { recognition.stop(); return }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { status.textContent = 'Transcrição indisponível. Digite a pergunta.'; return }
    stop()
    const session = new Recognition()
    recognition = session
    session.lang = 'pt-BR'
    session.onresult = event => {
      form.elements.pergunta.value = event.results[0][0].transcript.slice(0, 1600)
      status.textContent = 'Revise a transcrição e envie quando estiver pronta.'
    }
    session.onerror = () => {status.textContent = 'Falha na transcrição. Confira a permissão do microfone.'}
    session.onend = () => { recognition = undefined; mic.textContent = 'Falar pergunta'; submit.disabled = false }
    try {
      session.start()
      mic.textContent = 'Parar gravação'
      submit.disabled = true
    } catch {
      recognition = undefined
      status.textContent = 'Não foi possível iniciar o microfone.'
    }
  }
  function append(text) {
    const paragraph = document.createElement('p')
    paragraph.textContent = text
    log.append(paragraph)
    log.scrollTop = log.scrollHeight
  }
  form.onsubmit = async event => {
    event.preventDefault()
    const question = form.elements.pergunta.value.trim()
    if (!question || submit.disabled) return
    const started = window.getSimulationAssistantState()
    if (!started?.l3 || started.l3.mode !== 'ia') {
      status.textContent = 'O assistente está disponível após um evento com a IA ligada.'
      return
    }
    stop()
    const eventSnapshot = started.l3
    const timeline = document.querySelector('#tl').innerText
    submit.disabled = mic.disabled = true
    status.textContent = 'Consultando…'
    try {
      const response = await fetch('/api/assistente', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({pergunta:question, modo:form.elements.modo.value,
          evento:timeline.slice(-4000), historico:history.filter(entry=>entry.event===eventSnapshot).map(({role,content})=>({role,content}))})})
      const data = await response.json()
      if (!response.ok) throw Error(data.error)
      if (window.getSimulationAssistantState()?.l3 !== eventSnapshot) { status.textContent = 'O cenário mudou. Envie uma nova consulta.'; return }
      history = [...history, {event:eventSnapshot,role:'user',content:question},
        {event:eventSnapshot,role:'assistant',content:data.resposta}].slice(-6)
      append('Você: ' + question)
      append(data.modelo + ': ' + data.resposta)
      for (const source of data.fontes) append('Fonte ' + source.id + ' · ' + source.titulo + '\n' + source.texto)
      status.textContent = data.status
      form.elements.pergunta.value = ''
      if (form.elements.ler.checked) void speak(data.resposta)
    } catch (error) {status.textContent = error.message}
    finally {submit.disabled = mic.disabled = false}
  }
})()
