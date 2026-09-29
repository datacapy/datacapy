import Schema from 'schema'

describe('$or operator - match-all "*" spec', function () {
  it('should work with match-all "*" property spec in $or', async () => {
    const data = {
      config: {
        apiKey: 'abc123',
        timeout: 5000,
        retries: 3,
      },
    }

    const schema = new Schema({
      config: {
        $or: [
          {
            $type: Object,
            $spec: {
              '*': { $type: String },
            },
          },
          {
            $type: Object,
            $spec: {
              '*': { $type: Number },
            },
          },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
  })

  it('should validate object with match-all "*" spec requiring all properties to be strings', async () => {
    const data1 = {
      labels: {
        env: 'production',
        region: 'us-east',
        app: 'myapp',
      },
    }
    const data2 = {
      labels: {
        env: 'production',
        count: 5,
      },
    }

    const schema = new Schema({
      labels: {
        $or: [
          {
            $type: Object,
            $spec: {
              '*': { $type: String },
            },
          },
          String,
        ],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)
    expect(data1.labels.env).toBe('production')

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true) // Should still be valid because it can be cast to string
    expect(data2.labels.count).toBe('5') // Number should be cast to string
  })

  it('should work with match-all "*" spec with validation rules', async () => {
    const data = {
      metadata: {
        title: 'Hello',
        description: 'World',
        author: 'John',
      },
    }

    const schema = new Schema({
      metadata: {
        $or: [
          {
            $type: Object,
            $spec: {
              '*': {
                $type: String,
                $validate: { valueLength: { min: 3, max: 50 } },
              },
            },
          },
          { $type: String },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.metadata.title).toBe('Hello')
  })

  it('should use match-all "*" spec as fallback in $or', async () => {
    const data1 = {
      settings: {
        apiKey: 'secret123',
        endpoint: 'https://api.example.com',
      },
    }
    const data2 = {
      settings: {
        port: 8080,
        timeout: 5000,
        maxConnections: 100,
      },
    }

    const schema = new Schema({
      settings: {
        $or: [
          {
            $type: Object,
            $spec: {
              apiKey: String,
              endpoint: String,
            },
          },
          {
            $type: Object,
            $spec: {
              '*': Number, // Match all properties as numbers
            },
          },
        ],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)
    expect(data1.settings.apiKey).toBe('secret123')

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)
    expect(data2.settings.port).toBe(8080)
  })

  it('should work with nested objects and match-all "*" in $or', async () => {
    const data = {
      response: {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-cache',
          'x-custom-header': 'value',
        },
      },
    }

    const schema = new Schema({
      response: {
        headers: {
          $or: [
            {
              $type: Object,
              $spec: {
                '*': { $type: String },
              },
            },
            { $type: String },
          ],
        },
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.response.headers['content-type']).toBe('application/json')
  })

  it('should fail validation when match-all "*" spec validation fails', async () => {
    const data = {
      scores: {
        math: 95,
        english: 150, // This exceeds max value of 100
        science: 88,
      },
    }

    const schema = new Schema({
      scores: {
        $or: [
          {
            $type: Object,
            $spec: {
              '*': {
                $type: Number,
                $validate: { valueLength: { min: 0, max: 100 } },
              },
            },
          },
          { $type: Array },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors['scores']).toBeDefined()
  })

  it('should validate successfully with match-all "*" spec validation rules', async () => {
    const data = {
      config: {
        apiKey: 'key123',
        secretKey: 'secret456',
        endpoint: 'https://api.example.com',
      },
    }

    const schema = new Schema({
      config: {
        $or: [
          {
            $type: Object,
            $spec: {
              '*': {
                $type: String,
                $validate: { valueLength: { min: 5, max: 100 } },
              },
            },
          },
          { $type: String },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.config.apiKey).toBe('key123')
  })

  it('should accept empty object with match-all "*" spec when properties are not required', async () => {
    const dataWithStringAnswers = {
      answers: {
        question1: 'answer1',
        question2: 'answer2',
      },
    }
    const dataWithArrayAnswers = {
      answers: {
        question1: ['answer1a', 'answer1b'],
        question2: 'answer2',
      },
    }
    const dataWithEmptyAnswers = {
      answers: {},
    }

    const schema = new Schema({
      answers: {
        '*': {
          $or: [
            {
              $type: Array,
              $spec: {
                $type: String,
                $validate: { valueLength: { max: 100 } },
              },
            },
            {
              $type: String,
              $validate: { valueLength: { max: 100 } },
            },
          ],
        },
      },
    })

    // Should accept object with string properties
    const result1 = await schema.validate(dataWithStringAnswers)
    expect(result1.isValid).toBe(true)
    expect(dataWithStringAnswers.answers.question1).toBe('answer1')
    expect(dataWithStringAnswers.answers.question2).toBe('answer2')

    // Should accept object with mixed array and string properties
    const result2 = await schema.validate(dataWithArrayAnswers)
    expect(result2.isValid).toBe(true)
    expect(dataWithArrayAnswers.answers.question1).toEqual([
      'answer1a',
      'answer1b',
    ])
    expect(dataWithArrayAnswers.answers.question2).toBe('answer2')

    // Should also accept empty object (properties not required by default)
    const result3 = await schema.validate(dataWithEmptyAnswers)
    expect(result3.isValid).toBe(true)
    expect(dataWithEmptyAnswers.answers).toEqual({})
  })
})
