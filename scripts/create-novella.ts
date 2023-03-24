/*
# Create Novella from AI Conversation

- Choose a story file from provided list
- Rewrite the story in a dialogue-heavy novella format
- Fill in gaps and add details for a smoother narrative flow
- Introduce engaging and funny banter to maintain reader's interest
- Save the novella with a new filename provided by the user

> This script uses OpenAI's GPT-4 model to convert the selected story into a dialogue-heavy novella. The user must provide an OpenAI API key. The generated novella will be saved in the ".kenv/tmp" directory.
*/

// Name: Create Novella
// Description: Create a Novella from an AI Conversation powered by OpenAI
// Author: John Lindquist
// Twitter: @johnlindquist

import "@johnlindquist/kit"

let { ChatOpenAI } = await import("langchain/chat_models")
let { ConversationChain } = await import("langchain/chains")
let { CallbackManager } = await import("langchain/callbacks")
let { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } = await import("langchain/prompts")

let { globby } = await import("globby")

let filePaths = await globby(home(".kenv", "tmp", "**", "*.txt"))

let filePath = await arg(
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
      filePaths
    )

    // Split the grep output by line and map each filePath to an object
    return stdout.split("\n").map(filePath => {
      return {
        // Set the name property to the basename of the filePath
        name: path.basename(filePath),
        description: path.dirname(filePath),
        value: filePath,
        preview: async () => {
          let contents = await readFile(filePath, "utf-8")

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

let contents = await readFile(filePath, "utf-8")

let prompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `
    Create a filename for this story, lowercase, dashed, and ending in .txt on the first line
    Re-write the story from the "Choose Your Adventure" style into a dialogue-heavy novella
    Address the gaps in the story by filling in with details and segues
    Introduce lots of funny banter to keep the reader engaged and describe characters and scenes
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

let novella = await editor({
  onInit: async () => {
    await chain.call({
      input: contents,
    })
  },
})

let [fileName] = novella.split("\n")
let novellaPath = tmpPath(fileName)

await writeFile(novellaPath, novella)

await edit(novellaPath)
