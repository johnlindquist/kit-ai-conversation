// Name: Add Script Header
// Description: Create a Header from the Selected Script
// Author: John Lindquist
// Twitter: @johnlindquist

import "@johnlindquist/kit"

let { ChatOpenAI } = await import("langchain/chat_models")
let { ConversationChain } = await import("langchain/chains")
let { CallbackManager } = await import("langchain/callbacks")
let { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } = await import("langchain/prompts")

let { filePath } = await selectScript()

let contents = await readFile(filePath, "utf-8")

let prompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `
    Use the "TEMPLATE" of a multiline js comment with markdown as an example.
    Create a multi-line js comment markdown section to help explain the script to a new user
    Use terse, clear language to explain the script in rougly 5 bullet points or less.
    Avoid mentioning imported modules or libraries.
    Use a markdown blockquote \`>\` at the end if there's anything confusing or important to note.
    Always keep the markdown inside of the multiline js comment.
    
    --- TEMPLATE ---
    /*
    # Chat with ChatGPT
    
    - Opens the \`chat\` component
    - Type a message and press \`enter\` to send
    - The message is sent to the OpenAI API
    - The response from OpenAI is displayed in the chat
    - Repeat!
    */
    
    --- END TEMPLATE ---
          
      `.trim()
  ),

  HumanMessagePromptTemplate.fromTemplate("{input}"),
])

let openAIApiKey = await env("OPENAI_API_KEY", {
  hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
})

let llm = new ChatOpenAI({
  modelName: "gpt-4",
  openAIApiKey,
  streaming: true,
  callbackManager: CallbackManager.fromHandlers({
    handleLLMNewToken: async token => {
      if (!token) return
      editor.append(token)
    },
    handleLLMError: async err => {
      editor.append(JSON.stringify(err))
    },
    handleLLMEnd: async () => {
      log(`handleLLMEnd`)
    },
  }),
})

let chain = new ConversationChain({
  llm,
  prompt,
})

let header = await editor({
  onInit: async () => {
    await chain.call({
      input: contents,
    })
  },
})

let newScriptContents = `
${header}

${contents}
`.trim()

await writeFile(filePath, newScriptContents)

await edit(filePath)
