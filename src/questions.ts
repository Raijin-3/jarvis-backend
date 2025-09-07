export type Question =
  | {
      id: string;
      type: 'mcq';
      prompt: string;
      options: string[];
      answerIndex: number;
    }
  | { id: string; type: 'text'; prompt: string; answerText: string };

// Jarvis 2.0 Entry Test — 25 questions selected from the provided brief.
// Note: The UI adds a "Don't Know" option automatically for MCQs; do not include it here.
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    type: 'mcq',
    prompt: 'What is the correct way to create a variable in Python?',
    options: ['var x = 10', 'x := 10', 'x = 10', 'int x = 10'],
    answerIndex: 2,
  },
  {
    id: 'q2',
    type: 'mcq',
    prompt: 'Given a=5 and b=10, what is the output of print(a + b * 2)?',
    options: ['25', '20', '15', '30'],
    answerIndex: 0,
  },
  {
    id: 'q3',
    type: 'mcq',
    prompt: 'Which function converts a string to an integer in Python?',
    options: ['toInt()', 'convert()', 'int()', 'strToInt()'],
    answerIndex: 2,
  },
  {
    id: 'q4',
    type: 'mcq',
    prompt: 'How do you define a function in Python?',
    options: ['def func():', 'function func():', 'func def():', 'func():'],
    answerIndex: 0,
  },
  {
    id: 'q5',
    type: 'mcq',
    prompt:
      'What is the output of: x = 10; if x > 5: print("Greater") else: print("Smaller")',
    options: ['Greater', 'Smaller', 'Error', 'None of the above'],
    answerIndex: 0,
  },
  {
    id: 'q6',
    type: 'mcq',
    prompt: 'Which of the following is not a valid Python keyword?',
    options: ['import', 'def', 'class', 'function'],
    answerIndex: 3,
  },
  {
    id: 'q7',
    type: 'mcq',
    prompt:
      'What does this code output? x = [1, 2, 3]; x.append(4); print(len(x))',
    options: ['3', '4', 'Error', 'None of the above'],
    answerIndex: 1,
  },
  {
    id: 'q8',
    type: 'mcq',
    prompt: 'Which operator is used for floor division in Python?',
    options: ['/', '//', '%', '**'],
    answerIndex: 1,
  },
  {
    id: 'q9',
    type: 'mcq',
    prompt:
      'Given my_list = [1, 2, 3, 4, 5], what does print(my_list[2]) output?',
    options: ['2', '3', '4', 'Error'],
    answerIndex: 1,
  },
  {
    id: 'q10',
    type: 'mcq',
    prompt: 'Which of the following is an immutable data structure in Python?',
    options: ['List', 'Dictionary', 'Tuple', 'Set'],
    answerIndex: 2,
  },
  {
    id: 'q11',
    type: 'mcq',
    prompt: 'How can you remove a specific element from a set in Python?',
    options: [
      'set.remove(value)',
      'set.delete(value)',
      'set.discard(value)',
      'Both a and c',
    ],
    answerIndex: 3,
  },
  {
    id: 'q12',
    type: 'mcq',
    prompt:
      "What does this output? my_dict = { 'a': 1, 'b': 2 }; print(my_dict.get('c', 3))",
    options: ['None', 'Error', '3', '1'],
    answerIndex: 2,
  },
  {
    id: 'q13',
    type: 'mcq',
    prompt: 'Which methods add an element to a list?',
    options: ['append()', 'add()', 'insert()', 'Both a and c'],
    answerIndex: 3,
  },
  {
    id: 'q14',
    type: 'mcq',
    prompt: 'Which statement about Python dictionaries is true?',
    options: [
      'Keys can be duplicated.',
      'Keys must be immutable.',
      'Values must be unique.',
      'Dictionaries maintain order starting from Python 2.',
    ],
    answerIndex: 1,
  },
  {
    id: 'q15',
    type: 'mcq',
    prompt: 'How can you read a CSV file into a Pandas DataFrame?',
    options: [
      "pd.read_csv('file.csv')",
      "pandas.read_csv('file.csv')",
      "DataFrame.read_csv('file.csv')",
      "pd.load_csv('file.csv')",
    ],
    answerIndex: 0,
  },
  {
    id: 'q16',
    type: 'mcq',
    prompt: 'What does the head() function in Pandas do?',
    options: [
      'Returns the first few rows of a DataFrame',
      'Returns the last few rows of a DataFrame',
      'Adds a new column to a DataFrame',
      'Deletes the first row of a DataFrame',
    ],
    answerIndex: 0,
  },
  {
    id: 'q17',
    type: 'mcq',
    prompt: 'How do you calculate the mean of a column in a Pandas DataFrame?',
    options: [
      'DataFrame.mean()',
      'DataFrame.column.mean()',
      "DataFrame['column'].mean()",
      'Both b and c',
    ],
    answerIndex: 2,
  },
  {
    id: 'q18',
    type: 'mcq',
    prompt: 'Which methods are used to filter rows in Pandas?',
    options: ['.query()', '.filter()', 'Both a and b', 'None of the above'],
    answerIndex: 2,
  },
  {
    id: 'q19',
    type: 'mcq',
    prompt: 'What does groupby() do in Pandas?',
    options: [
      'Sorts the DataFrame',
      'Groups data based on a specific column',
      'Deletes duplicate rows',
      'None of the above',
    ],
    answerIndex: 1,
  },
  {
    id: 'q20',
    type: 'mcq',
    prompt: 'Which functions are used to combine multiple DataFrames?',
    options: ['merge()', 'concat()', 'Both a and b', 'join()'],
    answerIndex: 2,
  },
  {
    id: 'q21',
    type: 'mcq',
    prompt: 'How can you check for missing values in a DataFrame?',
    options: ['.isnull()', '.checknull()', '.findnull()', '.hasnull()'],
    answerIndex: 0,
  },
  {
    id: 'q22',
    type: 'mcq',
    prompt: 'What does the drop() method do in Pandas?',
    options: [
      'Deletes a row or column',
      'Drops duplicates',
      'Replaces missing values',
      'None of the above',
    ],
    answerIndex: 0,
  },
  {
    id: 'q23',
    type: 'mcq',
    prompt: 'Which function is used to create a line plot in Matplotlib?',
    options: ['plt.plot()', 'plt.lineplot()', 'plt.graph()', 'plt.draw()'],
    answerIndex: 0,
  },
  {
    id: 'q24',
    type: 'mcq',
    prompt: 'What does plt.show() do?',
    options: [
      'Displays the plot',
      'Saves the plot',
      'Closes the plot',
      'None of the above',
    ],
    answerIndex: 0,
  },
  {
    id: 'q25',
    type: 'mcq',
    prompt: 'Which method is used to create a bar chart in Matplotlib?',
    options: [
      'plt.bar()',
      'plt.barchart()',
      'plt.bargraph()',
      'plt.histogram()',
    ],
    answerIndex: 0,
  },
];
