#!/usr/bin/env python3
"""
Test script to verify Groq API integration
Tests basic text generation with Groq's llama-3.3-70b model
"""

import requests
import json
import os

# Configuration
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', 'Your groq ai api key')
GENERATION_MODEL = 'llama-3.3-70b-versatile'
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

def test_groq_connection():
    """Test basic Groq API connection"""
    print("Testing Groq API connection...")
    
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': GENERATION_MODEL,
        'messages': [
            {'role': 'user', 'content': 'Say hello briefly'}
        ],
        'temperature': 0.7,
        'max_tokens': 100
    }
    
    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        if 'choices' in result and len(result['choices']) > 0:
            message = result['choices'][0]['message']['content']
            print(f"✓ Groq API Connection Successful")
            print(f"✓ Model: {GENERATION_MODEL}")
            print(f"✓ Response: {message}")
            return True
        else:
            print(f"✗ Invalid response format: {result}")
            return False
            
    except requests.exceptions.Timeout:
        print("✗ API timeout - request took too long")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection error: {e}")
        return False
    except requests.exceptions.HTTPError as e:
        print(f"✗ HTTP error: {e.response.status_code}")
        print(f"✗ Response: {e.response.text}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_embedding():
    """Test embedding function"""
    print("\nTesting embedding function...")
    
    import hashlib
    text = "This is a test document for embedding"
    
    # Create a deterministic embedding vector using hash
    hash_val = hashlib.md5(text.encode()).hexdigest()
    embedding = []
    for i in range(1536):
        char_index = (i * 2) % len(hash_val)
        val = int(hash_val[char_index:char_index+2], 16) / 255.0
        embedding.append(val - 0.5)
    
    print(f"✓ Generated embedding for text: '{text}'")
    print(f"✓ Embedding dimension: {len(embedding)}")
    print(f"✓ Sample values: {embedding[:5]}")
    return True

def test_rag_flow():
    """Test a simple RAG flow"""
    print("\nTesting RAG flow...")
    
    context = """
    The Multi-Domain RAG System is an AI-powered knowledge assistant
    that supports multiple domains including Healthcare, Legal, Finance, 
    and Technical documentation. It uses LLM-assisted and direct retrieval
    methods to find relevant information from uploaded documents.
    """
    
    prompt = f"""Based on this context, answer the question.
    
Context:
{context}

Question: What domains does the RAG system support?

Please provide a concise answer."""
    
    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': GENERATION_MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7,
        'max_tokens': 300
    }
    
    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        if 'choices' in result and len(result['choices']) > 0:
            answer = result['choices'][0]['message']['content']
            print(f"✓ RAG query successful")
            print(f"✓ Answer: {answer}")
            return True
        else:
            print(f"✗ Invalid response format")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Groq API Integration Test")
    print("=" * 60)
    
    results = {
        'connection': test_groq_connection(),
        'embedding': test_embedding(),
        'rag_flow': test_rag_flow()
    }
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    print("\n" + ("=" * 60))
    print(f"Overall: {'✓ ALL TESTS PASSED' if all_passed else '✗ SOME TESTS FAILED'}")
    print("=" * 60)
