/*
# Adventure Time AI Conversation

- Start a "Choose Your Own Adventure" story with the AI assistant
- User starts the story, AI takes over and offers three options to choose from
- Options range from safe to insanely reckless; user's luck influences the outcome
- Select an option by typing the corresponding number (1., 2., or 3.)
- Story may end if user's luck runs out due to a dangerous choice
> Note: This script requires an OpenAI API key
*/

// Shortcut: option b
// Name: Adventure Time
// Description: AI Conversation powered by OpenAI
// Author: John Lindquist
// Twitter: @johnlindquist

import "@johnlindquist/kit"

let { ChatOpenAI } = await import("langchain/chat_models")
let { ConversationChain } = await import("langchain/chains")
let { BufferMemory } = await import("langchain/memory")
let { CallbackManager } = await import("langchain/callbacks")
let { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate, MessagesPlaceholder } = await import(
  "langchain/prompts"
)

let prompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `
    The following is a "Choose Your Own Adventure" story with an AI assistant.
    The user will start the story, and then the AI will take over.
    The AI will progress the story, then offer three options numbered "1.", "2.", and "3." which range from safe to insanely reckless for the user to choose from.
    If the user selects one of the options by typing "1.","2.", or "3.", the AI will continue the story from that selected option.
    The user is pretty lucky, but the more reckless the choice, then more danger they fall into.
    Sometimes their luck will run out and the AI will end the story if something bad happens to the user due to their choice.
      `.trim()
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
])

let openAIApiKey = await env("OPENAI_API_KEY", {
  hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
})

let currentMessage = ``
let id = null
let llm = new ChatOpenAI({
  modelName: "gpt-4",
  openAIApiKey,
  streaming: true,
  callbackManager: CallbackManager.fromHandlers({
    handleLLMStart: async () => {
      id = setTimeout(() => {
        chat.setMessage(-1, md(`### Sorry, the AI is taking a long time to respond.`))
        setLoading(true)
      }, 3000)
      log(`handleLLMStart`)
      currentMessage = ``
      chat.addMessage("")
    },
    handleLLMNewToken: async token => {
      clearTimeout(id)
      setLoading(false)
      if (!token) return
      currentMessage += token
      let htmlMessage = md(currentMessage)
      chat.setMessage(-1, htmlMessage)
    },
    handleLLMError: async err => {
      warn(`error`, JSON.stringify(err))
      chat.addMessage("")
      chat.setMessage(-1, err)
    },
    handleLLMEnd: async () => {
      log(`handleLLMEnd`)
    },
  }),
})

let memory = new BufferMemory({
  returnMessages: true,
})

let chain = new ConversationChain({
  llm,
  prompt,
  memory,
})

await chat({
  onSubmit: async input => {
    await chain.call({ input })
  },
})

let conversation = memory.chatHistory.messages
  .map(m => (m.constructor.name.startsWith("Human") ? memory.humanPrefix : memory.aiPrefix) + "\n" + m.text)
  .join("\n\n")

inspect(conversation)
