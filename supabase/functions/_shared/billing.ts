// Check before creating external calendar events; the database trigger enforces
// the same rule for direct writes and concurrent requests.
export const assertStudentCanBook = async (adminClient: any, studentId: string) => {
  const { error } = await adminClient.rpc("assert_student_can_book", { p_student_id: studentId });
  if (error) throw new Error(error.message || "Não foi possível verificar a liberação de novas aulas.");
};
