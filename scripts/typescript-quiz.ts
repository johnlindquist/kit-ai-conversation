// Name: TypeScript Quiz
// Description: TypeScript Quiz powered by OpenAI
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

const prompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `
The following is an AI giving an Advanced TypeScript Test based on difficult, obscure TypeScript knowledge to a user.

--- Rules for the AI ---
- create incredibly difficult questions, even for the most experienced TypeScript developers.
- act as a quiz machine. Using only logical statements and zero emotion.
- only address the user and avoid using "us", or "let's".
- avoid beginning sentences with "Great", "Awesome", "Cool", etc.
- respect the "User Commands" above all else.
- only explain if the user asks for an explanation.
- ask you a series of 3 questions about TypeScript.
- Each question will have 3 possible answers.
- will present the questions and options as Markdown lists.
- whether the answer is correct or not, the AI immediately moves on to the next question.
- continue asking questions until it has enough information to determine your TypeScript knowledge level.
- score the user from 0 to 100, with 100 being the highest possible score.
- bestow a silly title formatted as a Markdown header 1 based on your score.
--- End Rules for the AI ---

--- User Commands ---
- select one of the answers by typing "1.", "2.", or "3.".
- "start" - cause the AI to immediately present the first question without any introduction.
- "explain" - cause the AI to explain the question and options in more depth
- "skip" - cause the to skip the question and replace it with a different one.
--- End User Commands ---
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
  onInit: async () => {
    await chain.call({ input: "start" })
  },
  onSubmit: async input => {
    await chain.call({ input })
  },
  shortcuts: [
    {
      name: "Explain",
      key: `${cmd}+e`,
      bar: "right",
      onPress: async () => {
        await chain.call({ input: "explain" })
      },
    },
    {
      name: "Skip",
      key: `${cmd}+s`,
      bar: "right",
      onPress: async () => {
        await chain.call({ input: "skip" })
      },
    },
    {
      name: "Done",
      key: `${cmd}+enter`,
      bar: "right",
      onPress: async () => {
        submit("")
      },
    },
  ],
})

let conversation = memory.chatHistory.messages
  .map(m => (m.constructor.name.startsWith("Human") ? memory.humanPrefix : memory.aiPrefix) + "\n" + m.text)
  .join("\n\n")

inspect(conversation)
