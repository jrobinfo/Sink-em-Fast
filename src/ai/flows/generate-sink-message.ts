// This is an autogenerated file from Firebase Studio.
'use server';

/**
 * @fileOverview Generates a personalized 'You sunk my battleship!' message when a player sinks an opponent's ship.
 *
 * - generateSinkMessage - A function that generates the sinking message.
 * - GenerateSinkMessageInput - The input type for the generateSinkMessage function.
 * - GenerateSinkMessageOutput - The return type for the generateSinkMessage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateSinkMessageInputSchema = z.object({
  shipType: z.string().describe('The type of ship that was sunk (e.g., Destroyer, Battleship).'),
  numberOfHits: z.number().describe('The number of hits the ship sustained before sinking.'),
  playerName: z.string().describe('The name of the player who sunk the ship.'),
  opponentName: z.string().describe('The name of the player whose ship was sunk.'),
});
export type GenerateSinkMessageInput = z.infer<typeof GenerateSinkMessageInputSchema>;

const GenerateSinkMessageOutputSchema = z.object({
  sinkMessage: z.string().describe('The generated "You sunk my battleship!" message.'),
});
export type GenerateSinkMessageOutput = z.infer<typeof GenerateSinkMessageOutputSchema>;

export async function generateSinkMessage(input: GenerateSinkMessageInput): Promise<GenerateSinkMessageOutput> {
  return generateSinkMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSinkMessagePrompt',
  input: {
    schema: z.object({
      shipType: z.string().describe('The type of ship that was sunk (e.g., Destroyer, Battleship).'),
      numberOfHits: z.number().describe('The number of hits the ship sustained before sinking.'),
      playerName: z.string().describe('The name of the player who sunk the ship.'),
      opponentName: z.string().describe('The name of the player whose ship was sunk.'),
    }),
  },
  output: {
    schema: z.object({
      sinkMessage: z.string().describe('The generated "You sunk my battleship!" message.'),
    }),
  },
  prompt: `You are a creative message generator for the Battleship game. When a player sinks an opponent's ship, you generate a fun and personalized "You sunk my battleship!" message.

  Here are the details of the sinking:
  - Player Name: {{{playerName}}}
  - Opponent Name: {{{opponentName}}}
  - Ship Type: {{{shipType}}}
  - Number of Hits: {{{numberOfHits}}}

  Generate a creative and funny "You sunk my battleship!" message incorporating the provided details. The message should be no more than 50 words.
  Message: `,
});

const generateSinkMessageFlow = ai.defineFlow<
  typeof GenerateSinkMessageInputSchema,
  typeof GenerateSinkMessageOutputSchema
>({
  name: 'generateSinkMessageFlow',
  inputSchema: GenerateSinkMessageInputSchema,
  outputSchema: GenerateSinkMessageOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
