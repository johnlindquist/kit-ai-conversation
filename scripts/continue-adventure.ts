/*
# Continue Adventure

- Choose an existing "Choose Your Own Adventure" story
- The AI assistant will provide narrative and offer 3 choices: safe, moderate, and reckless
- The user selects an option to progress the story in that direction
- The AI adjusts the story based on luck and the user's choice
- The story may end if the user runs out of luck or if an ending is reached

> Requires an OpenAI API key to function.
*/
// Name: Continue Adventure
// Description: Continue an AI Conversation powered by OpenAI
// Author: John Lindquist
// Twitter: @johnlindquist

import "@johnlindquist/kit"

let { ChatOpenAI } = await import("langchain/chat_models")
let { ConversationChain } = await import("langchain/chains")
let { BufferMemory } = await import("langchain/memory")
let { CallbackManager } = await import("langchain/callbacks")
let {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} = await import("langchain/prompts")

let storiesPath = home(".kenv", "tmp", "adventure-time")
let fileNames = await readdir(storiesPath)

let fileName = await arg(
  {
    placeholder: "Choose a story",
    height: PROMPT.HEIGHT["5XL"],
  },
  async input => {
    // Run grep to search for files that contain the input
    // -i: Perform case-insensitive matching
    // -l: Print only the names of the files containing matches
    let { stdout } = grep(
      "-il",
      input,
      // Resolve the full paths of the files in the stories directory as an array of strings
      fileNames.map(fileName => path.resolve(storiesPath, fileName))
    )

    // Split the grep output by line and map each filePath to an object
    return stdout.split("\n").map(filePath => {
      return {
        // Set the name property to the basename of the filePath
        name: path.basename(filePath),
        value: filePath,
        preview: async () => {
          let contents = await readFile(path.resolve(storiesPath, filePath), "utf-8")

          // If the input length is less than 2, return the unmodified contents
          if (input.length < 2) {
            return md(contents)
          }

          // Create a RegExp object to match the input case-insensitively and globally
          let regex = new RegExp(input, "gi")
          // Replace the matched input in the contents with a highlighted version wrapped in a span with a "text-primary" class
          let highlightedContents = contents.replace(regex, match => `<span class="text-primary">${match}</span>`)
          // Return the contents with markdown formatting applied
          return md(highlightedContents)
        },
      }
    })
  }
)

let contents = await readFile(path.resolve(storiesPath, fileName), "utf-8")

let convertTextToMessages = text => {
  return text.split(`\n`).reduce((acc, line) => {
    if (line === "Human" || line === "AI") {
      acc.push({
        from: line,
        text: "",
      })

      return acc
    }

    acc.at(-1).text += line

    return acc
  }, [])
}

let messages = convertTextToMessages(contents)

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

  ...messages.map(message => {
    if (message.from === "Human") {
      return HumanMessagePromptTemplate.fromTemplate(message.text)
    }
    if (message.from === "AI") {
      return AIMessagePromptTemplate.fromTemplate(message.text)
    }
  }),

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
    await chain.call({
      input: `Summarize the story so far. If the last message was from the AI, re-present the options.`,
    })
  },
  onSubmit: async input => {
    await chain.call({ input })
  },
})

let conversation = memory.chatHistory.messages
  .map(m => (m.constructor.name.startsWith("Human") ? memory.humanPrefix : memory.aiPrefix) + "\n" + m.text)
  .join("\n\n")

inspect(conversation)
