import React, { useState } from 'react';
import { PuzzleDisplay, LeftControlPanel, LoadingState } from '../components';
import { FloatingHelpButton, StatusIndicator } from '../components/ui';
import { useAppState } from '../hooks/useAppState';
import puzzleService from '../services/puzzleService.js';
import { getStableUserId } from '../services/userIdentity.js';
import styles from './StudentPage.module.css';

function StudentPage() {
  const {
    currentPuzzle,
    useLocalData,
    isUsingApi,
    isLoading,
    healthLoading,
    handleNextPuzzle,
    toggleDataSource
  } = useAppState();

  // Puzzle generation state
  const [dataSource, setDataSource] = useState('smart');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [selectedProofTypes, setSelectedProofTypes] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generatedPuzzle, setGeneratedPuzzle] = useState(null);

  // Difficulty selection handler
  const handleDifficultyChange = (difficulty) => {
    setSelectedDifficulty(difficulty);
  };

  // Proof type toggle handler
  const handleProofTypesChange = (proofTypes) => {
    setSelectedProofTypes(proofTypes);
  };

  // Data source change handler
  const handleDataSourceChange = (source) => {
    setDataSource(source);
    setGeneratedPuzzle(null); // Clear generated puzzle when switching sources
    
    // Update the existing data source toggle if needed
    if (source === 'local' && !useLocalData) {
      toggleDataSource();
    } else if (source === 'smart' && useLocalData) {
      toggleDataSource();
    }
  };

  const handleGeneratePuzzle = async () => {
    console.log('🎯 Generate button clicked!');
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      if (dataSource === 'local') {
        // Local Database - filter from JSON files
        console.log('✅ Filtering local puzzles:', {
          difficulty: selectedDifficulty,
          proofTypes: selectedProofTypes
        });
        
        const { PuzzleLoader } = await import('../services/puzzleLoader.js');
        let filteredPuzzles = PuzzleLoader.getAllPuzzles();
        
        // Filter by difficulty
        if (selectedDifficulty) {
          filteredPuzzles = filteredPuzzles.filter(p => p.difficulty === selectedDifficulty);
        }
        
        // Filter by proof types (categories)
        if (selectedProofTypes.length > 0) {
          filteredPuzzles = filteredPuzzles.filter(p => {
            // Check if puzzle's tags include any of the selected proof types
            return selectedProofTypes.some(type => 
              p.tags.some(tag => tag.toLowerCase().includes(type.toLowerCase()))
            );
          });
        }
        
        if (filteredPuzzles.length === 0) {
          setGenerationError('No puzzles found matching your criteria. Try different filters.');
          return;
        }
        
        // Select random puzzle from filtered results
        const randomIndex = Math.floor(Math.random() * filteredPuzzles.length);
        const selectedPuzzle = filteredPuzzles[randomIndex];
        
        console.log('🎉 Selected puzzle from local database:', {
          id: selectedPuzzle.id,
          title: selectedPuzzle.displayTitle,
          difficulty: selectedPuzzle.difficulty,
          tags: selectedPuzzle.tags
        });
        
        setGeneratedPuzzle(selectedPuzzle);
      } else {
        const selectedPuzzle = await puzzleService.generatePuzzle({
          userId: getStableUserId(),
          requestId: crypto.randomUUID(),
          difficulty: selectedDifficulty || 'medium',
          topics: selectedProofTypes
        });
        setGeneratedPuzzle(selectedPuzzle);
      }
      
    } catch (error) {
      console.error('❌ Puzzle generation failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      setGenerationError(error.message || 'Failed to generate puzzle. Please try again.');
    } finally {
      setIsGenerating(false);
      console.log('🏁 Generation process complete');
    }
  };

  // Custom next puzzle handler that works with all data sources
  const handleCustomNextPuzzle = () => {
    if (dataSource === 'smart' || dataSource === 'local') {
      // For generated puzzles, trigger a new generation
      handleGeneratePuzzle();
    } else {
      // Fallback to default behavior
      handleNextPuzzle();
    }
  };

  // Determine which puzzle to display - generated puzzle takes priority
  const displayPuzzle = generatedPuzzle || currentPuzzle;

  const handlePuzzleTried = async (puzzleId, completed = false) => {
    if (dataSource !== 'smart') return;
    try {
      await puzzleService.recordPuzzleTried(puzzleId, getStableUserId(), completed);
    } catch (error) {
      console.warn('Unable to update puzzle history:', error.message);
    }
  };
  
  // Handle loading state
  if (isLoading) {
    return (
      <LoadingState 
        title="Loading puzzles..."
        message="Connecting to database..."
      />
    );
  }

  // Handle case where no puzzle is selected yet
  if (!displayPuzzle) {
    return (
      <LoadingState 
        title="No puzzles available"
        message="Please check your connection or try refreshing the page."
      />
    );
  }

  return (
    <div className={styles['student-page-container']}>
      <LeftControlPanel
        dataSource={dataSource}
        onDataSourceChange={handleDataSourceChange}
        selectedDifficulty={selectedDifficulty}
        onDifficultyChange={handleDifficultyChange}
        selectedProofTypes={selectedProofTypes}
        onProofTypesChange={handleProofTypesChange}
        onGeneratePuzzle={handleGeneratePuzzle}
        isGenerating={isGenerating}
        generationError={generationError}
      />

      <div className={styles['student-page']}>
        <header className={styles['page-header']}>
          <h1>Parsons Puzzles for Math Proofs</h1>
          <p>Practice formal mathematical proofs through interactive drag-and-drop puzzles</p>
        </header>

        <main className={styles['main-content']}>
          <PuzzleDisplay 
            key={displayPuzzle.id} 
            puzzle={displayPuzzle} 
            onNextPuzzle={handleCustomNextPuzzle}
            isLastPuzzle={false}
            onPuzzleTried={handlePuzzleTried}
          />
        </main>

        <StatusIndicator 
          isUsingApi={isUsingApi} 
          isLoading={isLoading || healthLoading}
        />
        <FloatingHelpButton />
      </div>
    </div>
  );
}

export default StudentPage;
